import { Worker, Job } from 'bullmq';
import { OneKhusa, isServiceError } from '@chiahq/sdk';
import { prisma, InvoiceStatus } from '@physiocore/db';
import { redisConnection } from '../redis';

const POLL_INTERVAL_MS = 30_000;

function providerConfig() {
  const merchantAccountNumber = Number(process.env.ONEKHUSA_MERCHANT_ACCOUNT_NUMBER);
  if (!process.env.ONEKHUSA_API_KEY || !process.env.ONEKHUSA_API_SECRET || !process.env.ONEKHUSA_ORGANISATION_ID || !Number.isInteger(merchantAccountNumber)) {
    return null;
  }

  const environment = process.env.ONEKHUSA_ENVIRONMENT === 'PRODUCTION' ? 'PRODUCTION' : 'DEVELOPMENT';
  return {
    merchantAccountNumber,
    client: new OneKhusa({
      apiKey: process.env.ONEKHUSA_API_KEY,
      apiSecret: process.env.ONEKHUSA_API_SECRET,
      organisationId: process.env.ONEKHUSA_ORGANISATION_ID,
      merchantAccountNumber,
      environment,
      sandboxUrl: process.env.ONEKHUSA_SANDBOX_URL,
      productionUrl: process.env.ONEKHUSA_PRODUCTION_URL,
    }),
  };
}

function validDate(value: string | Date, fallback = new Date()) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

const worker = new Worker('payment-requests', async (job: Job) => {
  if (job.name !== 'poll-payment-requests') throw new Error(`Unknown payment request job: ${job.name}`);
  const config = providerConfig();
  if (!config) return;

  const now = new Date();
  const requests = await prisma.paymentRequest.findMany({
    where: {
      status: { in: ['PENDING', 'PROCESSING'] },
      nextPollAt: { lte: now },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    include: { payment: true, invoice: true },
    orderBy: { nextPollAt: 'asc' },
    take: 100,
  });

  for (const request of requests) {
    try {
      const result = await config.client.collections.getTransactions({
        merchantAccountNumber: config.merchantAccountNumber,
        transactionDate: request.createdAt.toISOString().slice(0, 10),
        pageNumber: 1,
        numberOfReturnedRows: 100,
        isIncremental: false,
        searchBy: 'TransactionReferenceNumber',
        searchText: request.providerReference,
      });

      if (isServiceError(result)) {
        await scheduleNextPoll(request.id);
        continue;
      }

      const transaction = result.find((item) => item.transactionReferenceNumber === request.providerReference || item.transactionReferenceNumber === request.providerTransactionReference);
      if (!transaction) {
        await scheduleNextPoll(request.id);
        continue;
      }

      if (transaction.transactionStatusCode === 'S') {
        await settle(request.id, transaction);
      } else if (transaction.transactionStatusCode === 'R') {
        await reverse(request.id, transaction.transactionReferenceNumber);
      } else if (transaction.transactionStatusCode === 'F') {
        await prisma.paymentRequest.update({ where: { id: request.id }, data: { status: 'FAILED', failureReason: transaction.transactionStatusName, lastPolledAt: new Date(), nextPollAt: null } });
      } else {
        await scheduleNextPoll(request.id);
      }
    } catch (error) {
      console.error(`[PAYMENT_REQUEST] Poll ${request.id} failed:`, error);
      await scheduleNextPoll(request.id);
    }
  }
}, { connection: redisConnection });

async function scheduleNextPoll(id: string) {
  await prisma.paymentRequest.update({
    where: { id },
    data: { lastPolledAt: new Date(), nextPollAt: new Date(Date.now() + POLL_INTERVAL_MS) },
  });
}

async function settle(id: string, transaction: { transactionAmount: number; transactionReferenceNumber: string; transactionDate: string }) {
  await prisma.$transaction(async (tx) => {
    const request = await tx.paymentRequest.findUnique({ where: { id }, include: { payment: true, invoice: true } });
    if (!request || request.payment || request.status === 'PAID') return;
    if (Math.abs(Number(transaction.transactionAmount) - Number(request.amount)) > 0.005) {
      await tx.paymentRequest.update({ where: { id }, data: { status: 'FAILED', failureReason: 'OneKhusa payment amount did not match the requested amount', lastPolledAt: new Date(), nextPollAt: null } });
      return;
    }

    const paidBefore = await tx.payment.aggregate({ where: { tenantId: request.tenantId, invoiceId: request.invoiceId, status: 'COMPLETED' }, _sum: { amount: true } });
    if (Number(paidBefore._sum.amount || 0) + Number(request.amount) > Number(request.invoice.total) + 0.005) {
      await tx.paymentRequest.update({ where: { id }, data: { status: 'FAILED', failureReason: 'Payment exceeds the invoice balance', lastPolledAt: new Date(), nextPollAt: null } });
      return;
    }

    const payment = await tx.payment.create({
      data: {
        tenantId: request.tenantId,
        invoiceId: request.invoiceId,
        patientId: request.patientId,
        amount: request.amount,
        methodName: 'ONEKHUSA',
        reference: transaction.transactionReferenceNumber,
        status: 'COMPLETED',
        notes: 'Confirmed by OneKhusa request-to-pay polling',
        paymentRequestId: request.id,
        idempotencyKey: `ONEKHUSA:${request.id}`,
      },
    });

    if (Number(paidBefore._sum.amount || 0) + Number(request.amount) >= Number(request.invoice.total) - 0.005) {
      await tx.invoice.update({ where: { id: request.invoiceId }, data: { status: InvoiceStatus.PAID, paidAt: new Date(), paymentMethod: 'ONEKHUSA' } });
    }

    await tx.paymentRequest.update({
      where: { id },
      data: { status: 'PAID', providerTransactionReference: transaction.transactionReferenceNumber, providerPaidAt: validDate(transaction.transactionDate), lastPolledAt: new Date(), nextPollAt: null },
    });
    console.log(`[PAYMENT_REQUEST] Reconciled ${id} as payment ${payment.id}`);
  });
}

async function reverse(id: string, transactionReference: string) {
  await prisma.$transaction(async (tx) => {
    const request = await tx.paymentRequest.findUnique({ where: { id }, include: { payment: true, invoice: true } });
    if (!request) return;
    if (request.payment?.status === 'COMPLETED') {
      await tx.payment.update({ where: { id: request.payment.id }, data: { status: 'REFUNDED', notes: 'OneKhusa payment reversed by provider' } });
      const paid = await tx.payment.aggregate({ where: { tenantId: request.tenantId, invoiceId: request.invoiceId, status: 'COMPLETED' }, _sum: { amount: true } });
      if (Number(paid._sum.amount || 0) < Number(request.invoice.total) - 0.005) {
        await tx.invoice.update({ where: { id: request.invoiceId }, data: { status: InvoiceStatus.UNPAID, paidAt: null } });
      }
    }
    await tx.paymentRequest.update({ where: { id }, data: { status: 'REVERSED', providerTransactionReference: transactionReference, failureReason: 'Payment was reversed by OneKhusa', lastPolledAt: new Date(), nextPollAt: null } });
  });
}

export default worker;
