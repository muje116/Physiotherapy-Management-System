import { prisma, InvoiceStatus } from '@physiocore/db';
import { AppError, NotFoundError, ValidationError } from '../utils/errors';
import { calculateVat } from '../utils/helpers';
import { PaginatedResult } from '../types';
import { recordPayment } from './payment.service';
import { invoiceQueue } from '../queues/invoice.queue';

interface InvoiceQuery {
  page: number;
  limit: number;
  status?: string;
  patientId?: string;
  startDate?: string;
  endDate?: string;
}

function generateInvoiceNumber(tenantId: string): Promise<string> {
  return prisma.$transaction(async (tx) => {
    const now = new Date();
    const prefix = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-`;

    const lastInvoice = await tx.invoice.findFirst({
      where: { tenantId, invoiceNumber: { startsWith: prefix } },
      orderBy: { createdAt: 'desc' },
      select: { invoiceNumber: true },
    });

    let nextSeq = 1;
    if (lastInvoice) {
      const parts = lastInvoice.invoiceNumber.split('-');
      nextSeq = parseInt(parts[2], 10) + 1;
    }

    return `${prefix}${String(nextSeq).padStart(5, '0')}`;
  });
}

export async function list(tenantId: string, query: InvoiceQuery): Promise<PaginatedResult<any>> {
  const where: any = { tenantId };

  if (query.status) where.status = query.status as InvoiceStatus;
  if (query.patientId) where.patientId = query.patientId;

  if (query.startDate || query.endDate) {
    where.createdAt = {};
    if (query.startDate) where.createdAt.gte = new Date(query.startDate);
    if (query.endDate) where.createdAt.lte = new Date(query.endDate);
  }

  const [items, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      orderBy: { createdAt: 'desc' },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, patientCode: true } },
        appointment: { select: { id: true, startAt: true, type: true } },
      },
    }),
    prisma.invoice.count({ where }),
  ]);

  return { items, total, page: query.page, limit: query.limit };
}

export async function create(tenantId: string, data: {
  patientId: string;
  appointmentId?: string;
  lineItems: Array<{ description: string; qty: number; unitPrice: number; total: number }>;
  dueDate?: string;
  medicalAidClaim?: any;
}) {
  const patient = await prisma.patient.findFirst({
    where: { id: data.patientId, tenantId },
    select: { id: true },
  });
  if (!patient) throw new NotFoundError('Patient not found');

  if (data.appointmentId) {
    const appointment = await prisma.appointment.findFirst({
      where: { id: data.appointmentId, tenantId, patientId: data.patientId },
      select: { id: true },
    });
    if (!appointment) throw new NotFoundError('Appointment not found for patient');
  }

  const invoiceNumber = await generateInvoiceNumber(tenantId);

  const subtotal = data.lineItems.reduce((sum, item) => sum + item.total, 0);
  const { subtotal: st, vatAmount, total } = calculateVat(subtotal);

  const invoice = await prisma.invoice.create({
    data: {
      tenantId,
      invoiceNumber,
      patientId: data.patientId,
      appointmentId: data.appointmentId,
      lineItems: data.lineItems,
      subtotal: st,
      vatAmount,
      total,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      medicalAidClaim: data.medicalAidClaim || undefined,
    },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, patientCode: true } },
    },
  });

  return invoice;
}

export async function getById(tenantId: string, invoiceId: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, tenantId },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, patientCode: true, medicalAidName: true, medicalAidNo: true } },
      appointment: { select: { id: true, startAt: true, type: true } },
    },
  });

  if (!invoice) throw new NotFoundError('Invoice not found');
  return invoice;
}

export async function update(tenantId: string, invoiceId: string, data: any) {
  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, tenantId } });
  if (!invoice) throw new NotFoundError('Invoice not found');

  const updateData: any = {};

  if (data.lineItems) {
    const subtotal = data.lineItems.reduce((sum: number, item: any) => sum + item.total, 0);
    const vatResult = calculateVat(subtotal);
    updateData.lineItems = data.lineItems;
    updateData.subtotal = vatResult.subtotal;
    updateData.vatAmount = vatResult.vatAmount;
    updateData.total = vatResult.total;
  }

  if (data.status !== undefined) {
    if (data.status === InvoiceStatus.PAID) {
      throw new ValidationError('Use the payment endpoint to mark an invoice as paid');
    }
    updateData.status = data.status as InvoiceStatus;
  }
  if (data.paymentMethod !== undefined) updateData.paymentMethod = data.paymentMethod;
  if (data.medicalAidClaim !== undefined) updateData.medicalAidClaim = data.medicalAidClaim;

  return prisma.invoice.update({
    where: { id: invoiceId },
    data: updateData,
  });
}

export async function send(tenantId: string, invoiceId: string) {
  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, tenantId } });
  if (!invoice) throw new NotFoundError('Invoice not found');

  try {
    await invoiceQueue.add('send-invoice-email', {
      invoiceId: invoice.id,
      tenantId,
      patientId: invoice.patientId,
    }, {
      jobId: `invoice-email-${invoice.id}-${Date.now()}`,
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: true,
      removeOnFail: false,
    });
  } catch (error) {
    throw new AppError(503, 'QUEUE_UNAVAILABLE', 'Invoice email service is temporarily unavailable');
  }

  return invoice;
}

export async function markPaid(tenantId: string, invoiceId: string, paymentMethod?: string) {
  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, tenantId } });
  if (!invoice) throw new NotFoundError('Invoice not found');

  const totalPaid = await prisma.payment.aggregate({
    where: { tenantId, invoiceId, status: 'COMPLETED' },
    _sum: { amount: true },
  });
  const outstanding = Math.max(Number(invoice.total) - Number(totalPaid._sum.amount || 0), 0);

  if (outstanding > 0) {
    await recordPayment(tenantId, {
      patientId: invoice.patientId,
      invoiceId,
      amount: outstanding,
      methodName: paymentMethod || invoice.paymentMethod || 'OTHER',
    });
  }

  const updated = await prisma.invoice.findFirst({ where: { id: invoiceId, tenantId } });
  if (!updated) throw new NotFoundError('Invoice not found');
  return updated;
}

export async function submitToMedicalAid(tenantId: string, invoiceId: string) {
  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, tenantId } });
  if (!invoice) throw new NotFoundError('Invoice not found');
  if (!invoice.medicalAidClaim) throw new NotFoundError('Invoice has no medical aid claim data');

  return prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: InvoiceStatus.SUBMITTED_TO_MEDICAL_AID },
  });
}

export async function generatePdf(tenantId: string, invoiceId: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, tenantId },
    include: {
      patient: true,
      tenant: true,
    },
  });
  if (!invoice) throw new NotFoundError('Invoice not found');

  return invoice;
}

export async function getMedicalAidClaims(tenantId: string, query: { page: number; limit: number }) {
  const where: any = {
    tenantId,
    medicalAidClaim: { not: null },
  };

  const [items, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      orderBy: { createdAt: 'desc' },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, patientCode: true, medicalAidName: true, medicalAidNo: true } },
      },
    }),
    prisma.invoice.count({ where }),
  ]);

  return { items, total, page: query.page, limit: query.limit };
}

export async function updateClaimStatus(tenantId: string, claimId: string, status: string) {
  const invoice = await prisma.invoice.findFirst({ where: { id: claimId, tenantId } });
  if (!invoice) throw new NotFoundError('Invoice not found');

  if (!invoice.medicalAidClaim || typeof invoice.medicalAidClaim !== 'object' || Array.isArray(invoice.medicalAidClaim)) {
    throw new NotFoundError('Invoice has no medical aid claim data');
  }

  const medicalAidClaim = { ...(invoice.medicalAidClaim as Record<string, unknown>) } as any;
  const currentStatus = typeof medicalAidClaim.status === 'string'
    ? medicalAidClaim.status
    : invoice.status === InvoiceStatus.SUBMITTED_TO_MEDICAL_AID
      ? 'SUBMITTED'
      : invoice.status === InvoiceStatus.MEDICAL_AID_APPROVED
        ? 'APPROVED'
        : undefined;
  const allowedTransitions: Record<string, string[]> = {
    SUBMITTED: ['ACKNOWLEDGED', 'APPROVED', 'REJECTED'],
    ACKNOWLEDGED: ['APPROVED', 'REJECTED'],
    APPROVED: ['PAID'],
    REJECTED: ['SUBMITTED'],
  };

  if (!currentStatus) {
    if (status !== 'SUBMITTED') {
      throw new ValidationError('A medical aid claim must be submitted before its response is recorded');
    }
  } else if (currentStatus !== status && !allowedTransitions[currentStatus]?.includes(status)) {
    throw new ValidationError(`Cannot move a medical aid claim from ${currentStatus} to ${status}`);
  }

  medicalAidClaim.status = status;
  const invoiceStatus = status === 'APPROVED' ? InvoiceStatus.MEDICAL_AID_APPROVED
    : status === 'REJECTED' ? InvoiceStatus.MEDICAL_AID_REJECTED
      : status === 'PAID' ? InvoiceStatus.PAID
        : status === 'SUBMITTED' || status === 'ACKNOWLEDGED' ? InvoiceStatus.SUBMITTED_TO_MEDICAL_AID
          : undefined;

  return prisma.invoice.update({
    where: { id: claimId },
    data: {
      medicalAidClaim,
      ...(invoiceStatus ? { status: invoiceStatus } : {}),
      ...(status === 'PAID' ? { paidAt: new Date() } : {}),
    },
  });
}

export async function resubmitClaim(tenantId: string, claimId: string) {
  const invoice = await prisma.invoice.findFirst({ where: { id: claimId, tenantId } });
  if (!invoice) throw new NotFoundError('Invoice not found');

  if (!invoice.medicalAidClaim || typeof invoice.medicalAidClaim !== 'object' || Array.isArray(invoice.medicalAidClaim)) {
    throw new NotFoundError('Invoice has no medical aid claim data');
  }

  const medicalAidClaim = { ...(invoice.medicalAidClaim as Record<string, unknown>), status: 'SUBMITTED' } as any;

  return prisma.invoice.update({
    where: { id: claimId },
    data: { status: InvoiceStatus.SUBMITTED_TO_MEDICAL_AID, medicalAidClaim },
  });
}
