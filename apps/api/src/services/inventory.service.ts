import { prisma } from '@physiocore/db';
import { NotFoundError, ValidationError } from '../utils/errors';

function optionalDate(value: string | null | undefined) {
  return value === undefined ? undefined : value === null ? null : new Date(value);
}

async function verifyUser(tenantId: string, userId: string | null | undefined, label = 'Employee') {
  if (!userId) return null;
  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId, isActive: true },
    select: { id: true },
  });
  if (!user) throw new NotFoundError(`${label} not found or inactive`);
  return user;
}

export async function listAssets(tenantId: string, query: any) {
  const where: any = { tenantId };
  if (query.status) where.status = query.status;
  if (query.category) where.category = { contains: query.category, mode: 'insensitive' };
  if (query.search) {
    where.OR = [
      { assetTag: { contains: query.search, mode: 'insensitive' } },
      { name: { contains: query.search, mode: 'insensitive' } },
      { category: { contains: query.search, mode: 'insensitive' } },
      { serialNumber: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.asset.findMany({
      where,
      include: { assignedTo: { select: { id: true, firstName: true, lastName: true, jobTitle: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.asset.count({ where }),
  ]);

  return { items, total, page: query.page, limit: query.limit };
}

export async function createAsset(tenantId: string, data: any) {
  await verifyUser(tenantId, data.assignedToUserId);
  return prisma.asset.create({
    data: {
      tenantId,
      assetTag: data.assetTag,
      name: data.name,
      category: data.category,
      description: data.description || null,
      serialNumber: data.serialNumber || null,
      location: data.location || null,
      status: data.status,
      condition: data.condition,
      purchaseDate: optionalDate(data.purchaseDate),
      purchaseCost: data.purchaseCost ?? null,
      warrantyExpiresAt: optionalDate(data.warrantyExpiresAt),
      assignedToUserId: data.assignedToUserId || null,
    },
    include: { assignedTo: { select: { id: true, firstName: true, lastName: true, jobTitle: true } } },
  });
}

export async function updateAsset(tenantId: string, assetId: string, data: any) {
  const asset = await prisma.asset.findFirst({ where: { id: assetId, tenantId } });
  if (!asset) throw new NotFoundError('Asset not found');
  if (data.assignedToUserId !== undefined) await verifyUser(tenantId, data.assignedToUserId);

  const updateData: any = {};
  for (const field of ['assetTag', 'name', 'category', 'description', 'serialNumber', 'location', 'status', 'condition', 'assignedToUserId']) {
    if (data[field] !== undefined) updateData[field] = data[field] || null;
  }
  if (data.purchaseDate !== undefined) updateData.purchaseDate = optionalDate(data.purchaseDate);
  if (data.purchaseCost !== undefined) updateData.purchaseCost = data.purchaseCost;
  if (data.warrantyExpiresAt !== undefined) updateData.warrantyExpiresAt = optionalDate(data.warrantyExpiresAt);

  return prisma.asset.update({
    where: { id: assetId },
    data: updateData,
    include: { assignedTo: { select: { id: true, firstName: true, lastName: true, jobTitle: true } } },
  });
}

export async function retireAsset(tenantId: string, assetId: string) {
  const asset = await prisma.asset.findFirst({ where: { id: assetId, tenantId } });
  if (!asset) throw new NotFoundError('Asset not found');
  return prisma.asset.update({ where: { id: assetId }, data: { status: 'RETIRED', assignedToUserId: null } });
}

export async function listDrugs(tenantId: string, query: any) {
  const where: any = { tenantId };
  if (query.activeOnly) where.isActive = true;
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { genericName: { contains: query.search, mode: 'insensitive' } },
      { batchNumber: { contains: query.search, mode: 'insensitive' } },
      { supplier: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  // Prisma cannot compare two columns in a normal filter, so keep the
  // low-stock comparison in SQL and only page in memory for that optional
  // filter. The default path is fully database-paginated.
  if (!query.lowStockOnly) {
    const [items, total] = await Promise.all([
      prisma.drugInventory.findMany({
        where,
        orderBy: [{ expiryDate: 'asc' }, { name: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.drugInventory.count({ where }),
    ]);
    return { items, total, page: query.page, limit: query.limit };
  }

  delete where.quantityOnHand;
  const allItems = await prisma.drugInventory.findMany({ where, orderBy: [{ expiryDate: 'asc' }, { name: 'asc' }] });
  const filteredItems = allItems.filter((item) => item.quantityOnHand <= item.reorderLevel);
  const start = (query.page - 1) * query.limit;

  return {
    items: filteredItems.slice(start, start + query.limit),
    total: filteredItems.length,
    page: query.page,
    limit: query.limit,
  };
}

export async function getInventorySummary(tenantId: string) {
  const now = new Date();
  const expiryCutoff = new Date(now);
  expiryCutoff.setDate(expiryCutoff.getDate() + 30);
  const baseWhere = { tenantId, isActive: true };
  const [drugCount, totals, stockLevels, expiringSoonCount, expiredCount, assetCount] = await Promise.all([
    prisma.drugInventory.count({ where: baseWhere }),
    prisma.drugInventory.aggregate({ where: baseWhere, _sum: { quantityOnHand: true } }),
    prisma.drugInventory.findMany({ where: baseWhere, select: { quantityOnHand: true, reorderLevel: true } }),
    prisma.drugInventory.count({ where: { ...baseWhere, expiryDate: { gte: now, lte: expiryCutoff } } }),
    prisma.drugInventory.count({ where: { ...baseWhere, expiryDate: { lt: now } } }),
    prisma.asset.count({ where: { tenantId, status: { not: 'RETIRED' } } }),
  ]);

  return {
    drugCount,
    totalUnits: totals._sum.quantityOnHand || 0,
    lowStockCount: stockLevels.filter((drug) => drug.quantityOnHand <= drug.reorderLevel).length,
    expiringSoonCount,
    expiredCount,
    assetCount,
  };
}

export async function createDrug(tenantId: string, userId: string, data: any) {
  return prisma.$transaction(async (tx) => {
    const drug = await tx.drugInventory.create({
      data: {
        tenantId,
        name: data.name,
        genericName: data.genericName || null,
        strength: data.strength || null,
        dosageForm: data.dosageForm || null,
        unit: data.unit,
        batchNumber: data.batchNumber || 'UNSPECIFIED',
        expiryDate: optionalDate(data.expiryDate),
        supplier: data.supplier || null,
        storageLocation: data.storageLocation || null,
        quantityOnHand: data.initialQuantity,
        reorderLevel: data.reorderLevel,
        unitCost: data.unitCost ?? null,
      },
    });

    if (data.initialQuantity > 0) {
      await tx.drugStockMovement.create({
        data: {
          tenantId,
          drugInventoryId: drug.id,
          type: 'RECEIPT',
          quantity: data.initialQuantity,
          quantityDelta: data.initialQuantity,
          recordedByUserId: userId,
          reason: 'Initial stock',
        },
      });
    }

    return drug;
  });
}

export async function updateDrug(tenantId: string, drugId: string, data: any) {
  const drug = await prisma.drugInventory.findFirst({ where: { id: drugId, tenantId } });
  if (!drug) throw new NotFoundError('Drug inventory item not found');

  const updateData: any = {};
  for (const field of ['name', 'genericName', 'strength', 'dosageForm', 'unit', 'batchNumber', 'supplier', 'storageLocation', 'isActive']) {
    if (data[field] !== undefined) updateData[field] = data[field];
  }
  if (data.expiryDate !== undefined) updateData.expiryDate = optionalDate(data.expiryDate);
  if (data.reorderLevel !== undefined) updateData.reorderLevel = data.reorderLevel;
  if (data.unitCost !== undefined) updateData.unitCost = data.unitCost;

  return prisma.drugInventory.update({ where: { id: drugId }, data: updateData });
}

export async function receiveDrugStock(tenantId: string, drugId: string, userId: string, data: any) {
  return prisma.$transaction(async (tx) => {
    const drug = await tx.drugInventory.findFirst({ where: { id: drugId, tenantId, isActive: true } });
    if (!drug) throw new NotFoundError('Drug inventory item not found or inactive');

    const updated = await tx.drugInventory.update({
      where: { id: drugId },
      data: { quantityOnHand: { increment: data.quantity } },
    });
    await tx.drugStockMovement.create({
      data: {
        tenantId,
        drugInventoryId: drugId,
        type: 'RECEIPT',
        quantity: data.quantity,
        quantityDelta: data.quantity,
        recordedByUserId: userId,
        reference: data.reference || null,
        reason: data.reason || 'Stock received',
        notes: data.notes || null,
      },
    });
    return updated;
  });
}

export async function issueDrug(tenantId: string, drugId: string, userId: string, data: any) {
  if (!!data.patientId === !!data.recipientUserId) {
    throw new ValidationError('Specify exactly one patient or employee recipient');
  }

  return prisma.$transaction(async (tx) => {
    const drug = await tx.drugInventory.findFirst({ where: { id: drugId, tenantId, isActive: true } });
    if (!drug) throw new NotFoundError('Drug inventory item not found or inactive');
    if (drug.expiryDate && drug.expiryDate <= new Date()) {
      throw new ValidationError('Cannot issue expired stock');
    }

    if (data.patientId) {
      const patient = await tx.patient.findFirst({ where: { id: data.patientId, tenantId } });
      if (!patient) throw new NotFoundError('Patient recipient not found');
    }
    if (data.recipientUserId) {
      const employee = await tx.user.findFirst({ where: { id: data.recipientUserId, tenantId, isActive: true, role: { not: 'PATIENT' } } });
      if (!employee) throw new NotFoundError('Employee recipient not found or inactive');
    }

    const updated = await tx.drugInventory.updateMany({
      where: { id: drugId, tenantId, isActive: true, quantityOnHand: { gte: data.quantity } },
      data: { quantityOnHand: { decrement: data.quantity } },
    });
    if (updated.count !== 1) {
      throw new ValidationError(`Insufficient stock. Only ${drug.quantityOnHand} ${drug.unit}(s) are available.`);
    }

    const movement = await tx.drugStockMovement.create({
      data: {
        tenantId,
        drugInventoryId: drugId,
        type: 'ISSUE',
        quantity: data.quantity,
        quantityDelta: -data.quantity,
        patientId: data.patientId || null,
        recipientUserId: data.recipientUserId || null,
        recordedByUserId: userId,
        reference: data.reference || null,
        reason: data.reason || 'Issued',
        notes: data.notes || null,
      },
      include: {
        drugInventory: true,
        patient: { select: { id: true, patientCode: true, firstName: true, lastName: true } },
        recipientUser: { select: { id: true, firstName: true, lastName: true, jobTitle: true } },
      },
    });
    return movement;
  });
}

export async function adjustDrugStock(tenantId: string, drugId: string, userId: string, data: any) {
  return prisma.$transaction(async (tx) => {
    const drug = await tx.drugInventory.findFirst({ where: { id: drugId, tenantId, isActive: true } });
    if (!drug) throw new NotFoundError('Drug inventory item not found or inactive');
    const updateResult = await tx.drugInventory.updateMany({
      where: {
        id: drugId,
        tenantId,
        isActive: true,
        ...(data.quantityDelta < 0 ? { quantityOnHand: { gte: Math.abs(data.quantityDelta) } } : {}),
      },
      data: { quantityOnHand: { increment: data.quantityDelta } },
    });
    if (updateResult.count !== 1) {
      throw new ValidationError(`Cannot remove more stock than available (${drug.quantityOnHand} ${drug.unit}(s)).`);
    }
    const updated = await tx.drugInventory.findFirst({ where: { id: drugId, tenantId } });
    await tx.drugStockMovement.create({
      data: {
        tenantId,
        drugInventoryId: drugId,
        type: 'ADJUSTMENT',
        quantity: Math.abs(data.quantityDelta),
        quantityDelta: data.quantityDelta,
        recordedByUserId: userId,
        reference: data.reference || null,
        reason: data.reason,
        notes: data.notes || null,
      },
    });
    return updated;
  });
}

export async function listDrugMovements(tenantId: string, drugId: string, query: any) {
  const drug = await prisma.drugInventory.findFirst({ where: { id: drugId, tenantId }, select: { id: true } });
  if (!drug) throw new NotFoundError('Drug inventory item not found');

  const where = { tenantId, drugInventoryId: drugId };
  const [items, total] = await Promise.all([
    prisma.drugStockMovement.findMany({
      where,
      include: {
        patient: { select: { id: true, patientCode: true, firstName: true, lastName: true } },
        recipientUser: { select: { id: true, firstName: true, lastName: true, jobTitle: true } },
        recordedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.drugStockMovement.count({ where }),
  ]);
  return { items, total, page: query.page, limit: query.limit };
}

export async function listPatientDrugIssues(tenantId: string, patientId: string) {
  return prisma.drugStockMovement.findMany({
    where: { tenantId, patientId, type: 'ISSUE' },
    include: {
      drugInventory: true,
      recordedBy: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}
