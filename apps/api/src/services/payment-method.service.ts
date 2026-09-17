import { prisma } from '@physiocore/db';

function normalizeMethodData(data: any) {
  const { feePercentage, feePercent, ...rest } = data;
  const normalized = { ...rest };
  if (feePercent !== undefined || feePercentage !== undefined) {
    normalized.feePercent = feePercent ?? feePercentage;
  }
  return normalized;
}

export async function listMethods(tenantId: string) {
  return prisma.paymentMethod.findMany({ where: { tenantId }, orderBy: { name: 'asc' } });
}

export async function createMethod(tenantId: string, data: any) {
  return prisma.paymentMethod.create({ data: { ...normalizeMethodData(data), tenantId } });
}

export async function updateMethod(tenantId: string, id: string, data: any) {
  return prisma.paymentMethod.update({ where: { id, tenantId }, data: normalizeMethodData(data) });
}

export async function deleteMethod(tenantId: string, id: string) {
  return prisma.paymentMethod.delete({ where: { id, tenantId } });
}
