import { prisma } from '@physiocore/db';
import { NotFoundError, ValidationError } from '../utils/errors';

const claimTransitions: Record<string, string[]> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['ACKNOWLEDGED', 'APPROVED', 'REJECTED'],
  ACKNOWLEDGED: ['APPROVED', 'REJECTED'],
  APPROVED: ['PAID'],
  REJECTED: ['SUBMITTED'],
};

export async function listSchemes(tenantId: string) {
  return prisma.medicalScheme.findMany({ where: { tenantId }, orderBy: { name: 'asc' } });
}

export async function createScheme(tenantId: string, data: { name: string; code: string; tariffVersion?: string; contactNumber?: string; email?: string; isActive?: boolean }) {
  return prisma.medicalScheme.create({
    data: {
      tenantId,
      name: data.name,
      code: data.code,
      tariffVersion: data.tariffVersion || null,
      contactNumber: data.contactNumber || null,
      email: data.email || null,
      isActive: data.isActive ?? true,
    },
  });
}

export async function updateScheme(tenantId: string, id: string, data: { name?: string; code?: string; tariffVersion?: string; contactNumber?: string; email?: string; isActive?: boolean }) {
  const scheme = await prisma.medicalScheme.findFirst({ where: { id, tenantId } });
  if (!scheme) throw new NotFoundError('Medical scheme not found');
  return prisma.medicalScheme.update({ where: { id }, data });
}

export async function deleteScheme(tenantId: string, id: string) {
  const scheme = await prisma.medicalScheme.findFirst({ where: { id, tenantId } });
  if (!scheme) throw new NotFoundError('Medical scheme not found');
  return prisma.medicalScheme.delete({ where: { id } });
}

export async function listClaims(tenantId: string, query: any) {
  const where: any = { tenantId };
  if (query.status) where.status = query.status;
  if (query.schemeId) where.schemeId = query.schemeId;
  if (query.patientId) where.patientId = query.patientId;

  const items = await prisma.schemeClaim.findMany({
    where,
    include: { patient: true, scheme: true, invoice: true },
    orderBy: { createdAt: 'desc' },
    skip: ((query.page || 1) - 1) * (query.limit || 20),
    take: query.limit || 20,
  });
  const total = await prisma.schemeClaim.count({ where });
  return { items, total, page: query.page || 1, limit: query.limit || 20 };
}

export async function createClaim(tenantId: string, data: { invoiceId?: string; patientId: string; schemeId: string; tariffCode?: string; amount: number; notes?: string }) {
  const [scheme, patient, invoice] = await Promise.all([
    prisma.medicalScheme.findFirst({ where: { id: data.schemeId, tenantId, isActive: true }, select: { id: true } }),
    prisma.patient.findFirst({ where: { id: data.patientId, tenantId }, select: { id: true } }),
    data.invoiceId
      ? prisma.invoice.findFirst({ where: { id: data.invoiceId, tenantId }, select: { id: true, patientId: true } })
      : Promise.resolve(null),
  ]);
  if (!scheme) throw new NotFoundError('Medical scheme not found or inactive');
  if (!patient) throw new NotFoundError('Patient not found');
  if (data.invoiceId && !invoice) throw new NotFoundError('Invoice not found');
  if (invoice && invoice.patientId !== data.patientId) throw new ValidationError('Claim patient does not match the invoice patient');

  return prisma.schemeClaim.create({
    data: {
      tenantId,
      invoiceId: data.invoiceId || null,
      patientId: data.patientId,
      schemeId: data.schemeId,
      tariffCode: data.tariffCode || null,
      amount: data.amount,
      status: 'DRAFT',
      notes: data.notes || null,
    },
  });
}

export async function submitClaim(tenantId: string, id: string) {
  return prisma.$transaction(async (tx) => {
    const existingClaim = await tx.schemeClaim.findFirst({ where: { id, tenantId }, select: { id: true, status: true } });
    if (!existingClaim) throw new NotFoundError('Medical scheme claim not found');
    if (!['DRAFT', 'REJECTED'].includes(existingClaim.status)) {
      throw new ValidationError(`Cannot submit a claim from ${existingClaim.status} status`);
    }

    const claim = await tx.schemeClaim.update({
      where: { id, tenantId },
      data: { status: 'SUBMITTED', submittedAt: new Date() },
    });
    if (claim.invoiceId) {
      await tx.invoice.update({ where: { id: claim.invoiceId }, data: { status: 'SUBMITTED_TO_MEDICAL_AID' } });
    }
    return claim;
  });
}

export async function updateClaimStatus(tenantId: string, id: string, status: string, rejectionReason?: string) {
  return prisma.$transaction(async (tx) => {
    const existingClaim = await tx.schemeClaim.findFirst({ where: { id, tenantId }, select: { id: true, status: true } });
    if (!existingClaim) throw new NotFoundError('Medical scheme claim not found');
    if (existingClaim.status !== status && !claimTransitions[existingClaim.status]?.includes(status)) {
      throw new ValidationError(`Cannot move a claim from ${existingClaim.status} to ${status}`);
    }

    const update: any = { status };
    if (status === 'APPROVED' || status === 'PAID') update.responseAt = new Date();
    if (status === 'PAID') update.paidAt = new Date();
    if (rejectionReason) update.rejectionReason = rejectionReason;

    const claim = await tx.schemeClaim.update({ where: { id, tenantId }, data: update });

    if (claim.invoiceId) {
      const invoiceStatus = status === 'APPROVED' ? 'MEDICAL_AID_APPROVED'
        : status === 'PAID' ? 'PAID'
        : status === 'REJECTED' ? 'MEDICAL_AID_REJECTED'
        : undefined;
      if (invoiceStatus) {
        await tx.invoice.update({ where: { id: claim.invoiceId }, data: { status: invoiceStatus } });
      }
    }
    return claim;
  });
}

export async function getClaimsReport(tenantId: string, startDate?: string, endDate?: string) {
  const where: any = { tenantId };
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
      throw new ValidationError('Claim report end date must be after the start date');
    }
    where.submittedAt = { gte: start, lte: end };
  } else if (startDate || endDate) {
    throw new ValidationError('Claim reports require both startDate and endDate');
  }

  const claims = await prisma.schemeClaim.findMany({
    where,
    include: { scheme: true },
  });

  const totalSubmitted = claims.filter(c => c.status !== 'DRAFT').length;
  const approved = claims.filter(c => c.status === 'APPROVED' || c.status === 'PAID').length;
  const rejected = claims.filter(c => c.status === 'REJECTED').length;
  const pending = claims.filter(c => c.status === 'SUBMITTED' || c.status === 'ACKNOWLEDGED').length;
  const totalAmount = claims.reduce((sum, c) => sum + Number(c.amount), 0);
  const approvedAmount = claims.filter(c => c.status === 'APPROVED' || c.status === 'PAID').reduce((sum, c) => sum + Number(c.amount), 0);

  const byScheme = claims.reduce((acc: any, c) => {
    const name = c.scheme.name;
    if (!acc[name]) acc[name] = { scheme: name, count: 0, approved: 0, total: 0 };
    acc[name].count++;
    if (c.status === 'APPROVED' || c.status === 'PAID') acc[name].approved++;
    acc[name].total += Number(c.amount);
    return acc;
  }, {});

  return {
    totalSubmitted,
    approved,
    rejected,
    pending,
    approvalRate: totalSubmitted ? Math.round((approved / totalSubmitted) * 100) : 0,
    totalAmount,
    approvedAmount,
    byScheme: Object.values(byScheme),
  };
}
