import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { OneKhusa, isServiceError } from '@chiahq/sdk';
import type { OneKhusaTypes } from '@chiahq/sdk';
import { InvoiceStatus, prisma } from '@physiocore/db';
import { oneKhusaWebhookSchema } from '@physiocore/schema';
import { AppError, ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';
import { sendNotification } from './notification.service';
import { recordPayment } from './payment.service';

const ACTIVE_STATUSES = ['PENDING', 'PROCESSING'];
const FINAL_STATUSES = ['PAID', 'FAILED', 'EXPIRED', 'REVERSED'];
const POLL_INTERVAL_MS = 30_000;

type ProviderConfig = {
  client: OneKhusa;
  merchantAccountNumber: number;
  currency: string;
};

type SettlementDetails = {
  amount?: number;
  transactionReference?: string;
  paidAt?: Date;
  sourceAccountNumber?: string;
  sourceInstitution?: string;
  metadata?: unknown;
  providerEventId?: string;
};

function providerErrorMessage(result: { errorMessage?: string; errorObject?: string }) {
  return result.errorMessage || result.errorObject || 'OneKhusa rejected the payment request';
}

function getProviderConfig(): ProviderConfig {
  const apiKey = process.env.ONEKHUSA_API_KEY;
  const apiSecret = process.env.ONEKHUSA_API_SECRET;
  const organisationId = process.env.ONEKHUSA_ORGANISATION_ID;
  const merchantAccountNumber = Number(process.env.ONEKHUSA_MERCHANT_ACCOUNT_NUMBER);

  if (!apiKey || !apiSecret || !organisationId || !Number.isInteger(merchantAccountNumber)) {
    throw new ValidationError('OneKhusa is not configured. Set the API key, API secret, organisation ID, and merchant account number first.');
  }

  if (merchantAccountNumber < 10_000_000 || merchantAccountNumber > 99_999_999) {
    throw new ValidationError('ONEKHUSA_MERCHANT_ACCOUNT_NUMBER must be an 8-digit merchant account number.');
  }

  const environment = process.env.ONEKHUSA_ENVIRONMENT === 'PRODUCTION' ? 'PRODUCTION' : 'DEVELOPMENT';
  const client = new OneKhusa({
    apiKey,
    apiSecret,
    organisationId,
    merchantAccountNumber,
    environment,
    defaultCapturedBy: process.env.ONEKHUSA_CAPTURED_BY,
    sandboxUrl: process.env.ONEKHUSA_SANDBOX_URL,
    productionUrl: process.env.ONEKHUSA_PRODUCTION_URL,
  });

  return {
    client,
    merchantAccountNumber,
    currency: process.env.ONEKHUSA_CURRENCY || 'MWK',
  };
}

function createProviderReference() {
  return `PK${Date.now().toString(36)}${randomBytes(6).toString('hex')}`.slice(0, 25);
}

function nextPollAt() {
  return new Date(Date.now() + POLL_INTERVAL_MS);
}

function validDate(value: string | Date | undefined, fallback = new Date()) {
  const date = value ? new Date(value) : fallback;
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function serialiseRequest(request: any) {
  return {
    id: request.id,
    invoiceId: request.invoiceId,
    invoiceNumber: request.invoice?.invoiceNumber || null,
    patientId: request.patientId,
    patientName: request.patient ? `${request.patient.firstName} ${request.patient.lastName}` : null,
    patientCode: request.patient?.patientCode || null,
    provider: request.provider,
    providerReference: request.providerReference,
    merchantAccountNumber: request.merchantAccountNumber ? String(request.merchantAccountNumber) : null,
    timedAccountNumber: request.timedAccountNumber,
    accountNumber: request.timedAccountNumber,
    amount: Number(request.amount),
    currency: request.currency,
    status: request.status,
    expiresAt: request.expiresAt,
    lastPolledAt: request.lastPolledAt,
    nextPollAt: request.nextPollAt,
    providerTransactionReference: request.providerTransactionReference,
    providerPaidAt: request.providerPaidAt,
    sourceAccountNumber: request.sourceAccountNumber,
    sourceInstitution: request.sourceInstitution,
    failureReason: request.failureReason,
    requestedBy: request.requestedBy ? {
      id: request.requestedBy.id,
      name: `${request.requestedBy.firstName} ${request.requestedBy.lastName}`,
    } : null,
    paymentId: request.payment?.id || null,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  };
}

const requestInclude = {
  invoice: { select: { invoiceNumber: true } },
  patient: { select: { id: true, patientCode: true, firstName: true, lastName: true, email: true, phone: true } },
  requestedBy: { select: { id: true, firstName: true, lastName: true } },
  payment: { select: { id: true, status: true } },
};

export async function createPaymentRequest(tenantId: string, requestedById: string, data: { invoiceId: string; amount?: number }) {
  const config = getProviderConfig();
  const [invoice, requestedBy] = await Promise.all([
    prisma.invoice.findFirst({
      where: { id: data.invoiceId, tenantId },
      include: { patient: { select: { id: true, firstName: true, lastName: true, patientCode: true } } },
    }),
    prisma.user.findFirst({ where: { id: requestedById, tenantId }, select: { id: true, email: true } }),
  ]);

  if (!invoice) throw new NotFoundError('Invoice not found');
  if (!requestedBy) throw new NotFoundError('Requesting employee not found');
  if (invoice.status === InvoiceStatus.PAID || invoice.status === InvoiceStatus.MEDICAL_AID_APPROVED || invoice.status === InvoiceStatus.VOID) {
    throw new ForbiddenError('A payment request cannot be created for this invoice');
  }

  const existing = await prisma.paymentRequest.findFirst({
    where: {
      tenantId,
      invoiceId: data.invoiceId,
      status: { in: ACTIVE_STATUSES },
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    include: requestInclude,
    orderBy: { createdAt: 'desc' },
  });
  if (existing) throw new ConflictError('This invoice already has an active payment request');

  const totalPaid = await prisma.payment.aggregate({
    where: { tenantId, invoiceId: invoice.id, status: 'COMPLETED' },
    _sum: { amount: true },
  });
  const outstanding = Math.max(Number(invoice.total) - Number(totalPaid._sum.amount || 0), 0);
  const amount = data.amount ?? outstanding;
  if (!Number.isFinite(amount) || amount <= 0) throw new ValidationError('Payment request amount must be greater than zero');
  if (amount > outstanding + 0.005) throw new ValidationError('Payment request amount exceeds the invoice balance');

  const providerReference = createProviderReference();
  const pending = await prisma.paymentRequest.create({
    data: {
      tenantId,
      invoiceId: invoice.id,
      patientId: invoice.patientId,
      requestedById,
      provider: 'ONEKHUSA',
      providerReference,
      merchantAccountNumber: config.merchantAccountNumber,
      amount,
      currency: config.currency,
      status: 'PENDING',
      nextPollAt: nextPollAt(),
    },
    include: requestInclude,
  });

  try {
    const result = await config.client.collections.initiateRequestToPay({
      merchantAccountNumber: config.merchantAccountNumber,
      transactionAmount: amount,
      transactionDescription: `Physiotherapy invoice ${invoice.invoiceNumber}`,
      referenceNumber: providerReference,
      capturedBy: requestedBy.email,
    }, providerReference);

    if (isServiceError(result)) {
      throw new AppError(502, 'ONEKHUSA_ERROR', providerErrorMessage(result));
    }

    const expiryDate = new Date(result.expiryDate);
    const updated = await prisma.paymentRequest.update({
      where: { id: pending.id },
      data: {
        timedAccountNumber: result.timedAccountNumber,
        expiresAt: Number.isNaN(expiryDate.getTime()) ? new Date(Date.now() + 15 * 60 * 1000) : expiryDate,
        nextPollAt: nextPollAt(),
      },
      include: requestInclude,
    });
    void notifyPatientOfPaymentRequest(updated).catch((error) => {
      console.warn(`[PAYMENT_REQUEST] Notification for ${updated.id} failed:`, error);
    });
    return serialiseRequest(updated);
  } catch (error) {
    await prisma.paymentRequest.update({
      where: { id: pending.id },
      data: { status: 'FAILED', failureReason: error instanceof Error ? error.message : 'Unable to initiate OneKhusa request' },
    });
    throw error;
  }
}

async function notifyPatientOfPaymentRequest(request: any) {
  const patient = request.patient;
  if (!patient) return false;

  const accountNumber = request.timedAccountNumber || 'the account number shown in your patient portal';
  const expires = request.expiresAt ? validDate(request.expiresAt).toLocaleString() : 'the expiry time shown in your patient portal';
  const body = `Hello ${patient.firstName}, a payment request for ${request.currency} ${Number(request.amount).toFixed(2)} is ready for invoice ${request.invoice?.invoiceNumber || request.invoiceId}. Pay using account ${accountNumber} and reference ${request.providerReference}. It expires ${expires}.`;
  const deliveries: Promise<boolean>[] = [];

  if (patient.email) {
    deliveries.push(sendNotification({
      to: patient.email,
      subject: 'Payment request ready',
      body,
      channel: 'EMAIL',
      tenantId: request.tenantId,
      patientId: request.patientId,
    }));
  }
  if (patient.phone) {
    deliveries.push(sendNotification({
      to: patient.phone,
      body,
      channel: 'SMS',
      tenantId: request.tenantId,
      patientId: request.patientId,
    }));
  }

  const results = await Promise.all(deliveries);
  return results.some(Boolean);
}

export async function listPaymentRequests(tenantId: string, query: { page?: number; limit?: number; invoiceId?: string; patientId?: string; status?: string }) {
  const where: any = { tenantId };
  if (query.invoiceId) where.invoiceId = query.invoiceId;
  if (query.patientId) where.patientId = query.patientId;
  if (query.status) where.status = query.status;
  const page = query.page || 1;
  const limit = query.limit || 20;
  const [items, total] = await Promise.all([
    prisma.paymentRequest.findMany({ where, include: requestInclude, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.paymentRequest.count({ where }),
  ]);
  return { items: items.map(serialiseRequest), total, page, limit };
}

export async function getPaymentRequest(tenantId: string, id: string) {
  const request = await prisma.paymentRequest.findFirst({ where: { id, tenantId }, include: requestInclude });
  if (!request) throw new NotFoundError('Payment request not found');
  return serialiseRequest(request);
}

export async function listPatientPaymentRequests(tenantId: string, patientId: string) {
  const requests = await prisma.paymentRequest.findMany({
    where: { tenantId, patientId },
    include: requestInclude,
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return requests.map(serialiseRequest);
}

async function reversePaymentRequest(requestId: string, details: SettlementDetails = {}) {
  return prisma.$transaction(async (tx) => {
    const request = await tx.paymentRequest.findUnique({
      where: { id: requestId },
      include: { payment: true, invoice: true },
    });
    if (!request) throw new NotFoundError('Payment request not found');

    if (request.payment && request.payment.status === 'COMPLETED') {
      await tx.payment.update({ where: { id: request.payment.id }, data: { status: 'REFUNDED', notes: 'OneKhusa payment reversed by provider' } });
      const paid = await tx.payment.aggregate({
        where: { tenantId: request.tenantId, invoiceId: request.invoiceId, status: 'COMPLETED' },
        _sum: { amount: true },
      });
      if (Number(paid._sum.amount || 0) < Number(request.invoice.total) - 0.005) {
        await tx.invoice.update({ where: { id: request.invoiceId }, data: { status: InvoiceStatus.UNPAID, paidAt: null } });
      }
    }

    const updated = await tx.paymentRequest.update({
      where: { id: requestId },
      data: {
        status: 'REVERSED',
        providerTransactionReference: details.transactionReference || request.providerTransactionReference,
        providerEventId: details.providerEventId || request.providerEventId,
        failureReason: 'Payment was reversed by OneKhusa',
        metadata: details.metadata as any,
      },
      include: requestInclude,
    });
    return serialiseRequest(updated);
  });
}

export async function settlePaymentRequest(requestId: string, details: SettlementDetails = {}) {
  const request = await prisma.paymentRequest.findUnique({
    where: { id: requestId },
    include: { payment: true },
  });
  if (!request) throw new NotFoundError('Payment request not found');
  if (request.status === 'REVERSED') return getPaymentRequest(request.tenantId, request.id);
  if (request.payment?.status === 'COMPLETED' || request.status === 'PAID') return getPaymentRequest(request.tenantId, request.id);

  const receivedAmount = details.amount ?? Number(request.amount);
  if (Math.abs(receivedAmount - Number(request.amount)) > 0.005) {
    const failed = await prisma.paymentRequest.update({
      where: { id: request.id },
      data: { status: 'FAILED', failureReason: 'OneKhusa payment amount did not match the requested amount', metadata: details.metadata as any },
      include: requestInclude,
    });
    return serialiseRequest(failed);
  }

  try {
    await recordPayment(request.tenantId, {
      patientId: request.patientId,
      invoiceId: request.invoiceId,
      amount: receivedAmount,
      methodName: 'ONEKHUSA',
      reference: details.transactionReference || request.providerReference,
      notes: 'Confirmed by OneKhusa request-to-pay',
      paymentRequestId: request.id,
      idempotencyKey: `ONEKHUSA:${request.id}`,
    });
  } catch (error) {
    const alreadySettled = await prisma.paymentRequest.findUnique({ where: { id: request.id }, include: { payment: true } });
    if (!alreadySettled?.payment) throw error;
  }

  const updated = await prisma.paymentRequest.update({
    where: { id: request.id },
    data: {
      status: 'PAID',
      providerTransactionReference: details.transactionReference || request.providerTransactionReference,
      providerEventId: details.providerEventId || request.providerEventId,
      providerPaidAt: details.paidAt || new Date(),
      sourceAccountNumber: details.sourceAccountNumber || request.sourceAccountNumber,
      sourceInstitution: details.sourceInstitution || request.sourceInstitution,
      metadata: details.metadata as any,
      failureReason: null,
      lastPolledAt: new Date(),
      nextPollAt: null,
    },
    include: requestInclude,
  });
  return serialiseRequest(updated);
}

export async function pollPaymentRequest(tenantId: string, id: string) {
  const request = await prisma.paymentRequest.findFirst({ where: { id, tenantId }, include: requestInclude });
  if (!request) throw new NotFoundError('Payment request not found');
  if (FINAL_STATUSES.includes(request.status)) return serialiseRequest(request);
  if (request.expiresAt && request.expiresAt <= new Date()) {
    const expired = await prisma.paymentRequest.update({ where: { id }, data: { status: 'EXPIRED', lastPolledAt: new Date(), nextPollAt: null }, include: requestInclude });
    return serialiseRequest(expired);
  }

  const config = getProviderConfig();
  const result = await config.client.collections.getTransactions({
    merchantAccountNumber: config.merchantAccountNumber,
    transactionDate: new Date(request.createdAt).toISOString().slice(0, 10),
    pageNumber: 1,
    numberOfReturnedRows: 100,
    isIncremental: false,
    searchBy: 'TransactionReferenceNumber',
    searchText: request.providerReference,
  });

  if (isServiceError(result)) {
    const checked = await prisma.paymentRequest.update({ where: { id }, data: { lastPolledAt: new Date(), nextPollAt: nextPollAt() }, include: requestInclude });
    return serialiseRequest(checked);
  }

  const transaction = result.find((item) => item.transactionReferenceNumber === request.providerReference || item.transactionReferenceNumber === request.providerTransactionReference);
  if (!transaction) {
    const checked = await prisma.paymentRequest.update({ where: { id }, data: { lastPolledAt: new Date(), nextPollAt: nextPollAt() }, include: requestInclude });
    return serialiseRequest(checked);
  }

  if (transaction.transactionStatusCode === 'S') {
    return settlePaymentRequest(id, {
      amount: transaction.transactionAmount,
      transactionReference: transaction.transactionReferenceNumber,
      paidAt: validDate(transaction.transactionDate),
      metadata: transaction,
    });
  }
  if (transaction.transactionStatusCode === 'R') {
    return reversePaymentRequest(id, { transactionReference: transaction.transactionReferenceNumber, metadata: transaction });
  }

  const updated = await prisma.paymentRequest.update({
    where: { id },
    data: { status: transaction.transactionStatusCode === 'F' ? 'FAILED' : 'PROCESSING', failureReason: transaction.transactionStatusCode === 'F' ? transaction.transactionStatusName : null, lastPolledAt: new Date(), nextPollAt: transaction.transactionStatusCode === 'F' ? null : nextPollAt() },
    include: requestInclude,
  });
  return serialiseRequest(updated);
}

export function verifyWebhookSignature(rawBody: string, signature: string | undefined) {
  const secret = process.env.ONEKHUSA_WEBHOOK_SECRET;
  if (!secret || !rawBody || !signature) return false;
  const computed = createHmac('sha512', secret).update(rawBody, 'utf8').digest('hex');
  const expectedBuffer = Buffer.from(computed, 'utf8');
  const receivedBuffer = Buffer.from(signature.toLowerCase(), 'utf8');
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}

export async function handleWebhook(event: string | undefined, rawBody: string, signature: string | undefined) {
  if (!verifyWebhookSignature(rawBody, signature)) throw new AppError(401, 'INVALID_WEBHOOK_SIGNATURE', 'Invalid OneKhusa webhook signature');
  if (!['payrequest.success', 'payrequest.reversed'].includes(event || '')) return { matched: false, ignored: true };

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    throw new ValidationError('Invalid OneKhusa webhook payload');
  }
  const parsedPayload = oneKhusaWebhookSchema.safeParse(parsedBody);
  if (!parsedPayload.success) {
    throw new ValidationError('Invalid OneKhusa webhook payload', parsedPayload.error.issues);
  }
  const payload = parsedPayload.data;
  const providerReference = payload.metaData?.referenceNumber;
  const timedAccountNumber = payload.metaData?.timedAccountNumber || payload.beneficiaryAccountNumber;
  const request = await prisma.paymentRequest.findFirst({
    where: {
      provider: 'ONEKHUSA',
      OR: [
        ...(providerReference ? [{ providerReference }] : []),
        ...(timedAccountNumber ? [{ timedAccountNumber }] : []),
      ],
    },
  });
  if (!request) return { matched: false, ignored: false };

  if (event === 'payrequest.reversed') {
    return { matched: true, request: await reversePaymentRequest(request.id, {
      transactionReference: payload.transactionReferenceNumber,
      providerEventId: payload.transactionReferenceNumber ? `${event}:${payload.transactionReferenceNumber}` : undefined,
      metadata: payload,
    }) };
  }

  const transactionDate = payload.transactionDate ? new Date(payload.transactionDate) : new Date();
  return {
    matched: true,
    request: await settlePaymentRequest(request.id, {
      amount: payload.transactionAmount,
      transactionReference: payload.transactionReferenceNumber,
      providerEventId: payload.transactionReferenceNumber ? `${event}:${payload.transactionReferenceNumber}` : undefined,
      paidAt: Number.isNaN(transactionDate.getTime()) ? new Date() : transactionDate,
      sourceAccountNumber: payload.sourceAccountNumber,
      sourceInstitution: payload.sourceInstitution,
      metadata: payload,
    }),
  };
}

export function isPaymentRequestProviderConfigured() {
  return Boolean(
    process.env.ONEKHUSA_API_KEY &&
    process.env.ONEKHUSA_API_SECRET &&
    process.env.ONEKHUSA_ORGANISATION_ID &&
    process.env.ONEKHUSA_MERCHANT_ACCOUNT_NUMBER,
  );
}

export type { OneKhusaTypes };
