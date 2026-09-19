import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@physiocore/db', () => ({
  prisma: {
    asset: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    drugInventory: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    drugStockMovement: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    patient: {
      findFirst: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { prisma } from '@physiocore/db';
import * as inventoryService from '../services/inventory.service';

describe('inventory.service', () => {
  const tenantId = 'tenant-1';
  const drug = {
    id: 'drug-1',
    tenantId,
    name: 'Ibuprofen',
    unit: 'tablet',
    quantityOnHand: 10,
    reorderLevel: 2,
    isActive: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(prisma as any));
  });

  it('issues medication to a patient and records a negative stock movement', async () => {
    vi.mocked(prisma.drugInventory.findFirst).mockResolvedValue(drug as any);
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'patient-1', tenantId } as any);
    vi.mocked(prisma.drugInventory.updateMany).mockResolvedValue({ count: 1 } as any);
    vi.mocked(prisma.drugStockMovement.create).mockResolvedValue({ id: 'movement-1', quantityDelta: -3 } as any);

    const result = await inventoryService.issueDrug(tenantId, 'drug-1', 'user-1', {
      quantity: 3,
      patientId: 'patient-1',
      reason: 'Treatment course',
    });

    expect(result.id).toBe('movement-1');
    expect(prisma.drugInventory.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ quantityOnHand: { gte: 3 } }),
      data: { quantityOnHand: { decrement: 3 } },
    }));
    expect(prisma.drugStockMovement.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ patientId: 'patient-1', quantity: 3, quantityDelta: -3, type: 'ISSUE' }),
    }));
  });

  it('rejects an issue when the atomic stock update cannot reserve enough units', async () => {
    vi.mocked(prisma.drugInventory.findFirst).mockResolvedValue(drug as any);
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'patient-1', tenantId } as any);
    vi.mocked(prisma.drugInventory.updateMany).mockResolvedValue({ count: 0 } as any);

    await expect(inventoryService.issueDrug(tenantId, 'drug-1', 'user-1', {
      quantity: 11,
      patientId: 'patient-1',
    })).rejects.toThrow('Insufficient stock');

    expect(prisma.drugStockMovement.create).not.toHaveBeenCalled();
  });

  it('rejects an inactive employee as a recipient', async () => {
    vi.mocked(prisma.drugInventory.findFirst).mockResolvedValue(drug as any);
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

    await expect(inventoryService.issueDrug(tenantId, 'drug-1', 'user-1', {
      quantity: 1,
      recipientUserId: 'employee-1',
    })).rejects.toThrow('Employee recipient not found or inactive');
  });
});
