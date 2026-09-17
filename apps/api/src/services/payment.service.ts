import { prisma } from '@physiocore/db';
import { NotFoundError, ValidationError } from '../utils/errors';

export async function listPayments(tenantId: string, query: any) {
  const where: any = { tenantId };
  if (query.patientId) where.patientId = query.patientId;
  if (query.invoiceId) where.invoiceId = query.invoiceId;
  if (query.status) where.status = query.status;
  if (query.startDate && query.endDate) {
    where.paidAt = { gte: new Date(query.startDate), lte: new Date(query.endDate) };
  }

  const items = await prisma.payment.findMany({
    where,
    include: { patient: true, invoice: true, paymentMethod: true },
    orderBy: { paidAt: 'desc' },
    skip: ((query.page || 1) - 1) * (query.limit || 20),
    take: query.limit || 20,
  });
  const total = await prisma.payment.count({ where });
  return { items, total, page: query.page || 1, limit: query.limit || 20 };
}

export async function recordPayment(tenantId: string, data: any) {
  const [patient, method, invoice] = await Promise.all([
    prisma.patient.findFirst({
      where: { id: data.patientId, tenantId },
      select: { id: true },
    }),
    data.paymentMethodId
      ? prisma.paymentMethod.findFirst({
          where: { id: data.paymentMethodId, tenantId, isActive: true },
        })
      : Promise.resolve(null),
    data.invoiceId
      ? prisma.invoice.findFirst({
          where: { id: data.invoiceId, tenantId },
        })
      : Promise.resolve(null),
  ]);

  if (!patient) throw new NotFoundError('Patient not found');
  if (data.paymentMethodId && !method) throw new NotFoundError('Payment method not found or inactive');
  if (data.invoiceId && !invoice) throw new NotFoundError('Invoice not found');
  if (invoice?.patientId && invoice.patientId !== data.patientId) {
    throw new ValidationError('Payment patient does not match the invoice patient');
  }
  if (invoice?.status === 'VOID') throw new ValidationError('Cannot record a payment against a void invoice');

  const methodName = method?.name || data.methodName || 'OTHER';

  return prisma.$transaction(async (tx) => {
    let paidBefore = 0;

    if (invoice) {
      const totalPaid = await tx.payment.aggregate({
        where: { tenantId, invoiceId: invoice.id, status: 'COMPLETED' },
        _sum: { amount: true },
      });
      paidBefore = Number(totalPaid._sum.amount || 0);

      if (paidBefore + Number(data.amount) > Number(invoice.total) + 0.005) {
        throw new ValidationError('Payment exceeds the invoice balance');
      }
    }

    const payment = await tx.payment.create({
      data: {
        tenantId,
        invoiceId: data.invoiceId || null,
        patientId: data.patientId,
        amount: data.amount,
        paymentMethodId: data.paymentMethodId || null,
        methodName,
        reference: data.reference || null,
        status: 'COMPLETED',
        notes: data.notes || null,
      },
    });

    if (invoice && paidBefore + Number(data.amount) >= Number(invoice.total) - 0.005) {
      await tx.invoice.update({
        where: { id: invoice.id },
        data: { status: 'PAID', paidAt: new Date(), paymentMethod: methodName },
      });
    }

    return payment;
  });
}

export async function getPaymentSummary(tenantId: string) {
  const totalCollected = await prisma.payment.aggregate({
    where: { tenantId, status: 'COMPLETED' },
    _sum: { amount: true },
  });
  const byMethod = await prisma.payment.groupBy({
    by: ['methodName'],
    where: { tenantId, status: 'COMPLETED' },
    _sum: { amount: true },
    _count: { id: true },
  });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayCollections = await prisma.payment.aggregate({
    where: { tenantId, status: 'COMPLETED', paidAt: { gte: today } },
    _sum: { amount: true },
  });

  return {
    totalCollected: totalCollected._sum.amount || 0,
    todayCollections: todayCollections._sum.amount || 0,
    byMethod: byMethod.map(m => ({ method: m.methodName, total: m._sum.amount || 0, count: m._count.id })),
  };
}
