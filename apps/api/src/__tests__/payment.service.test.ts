import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@physiocore/db', () => ({
  prisma: {
    payment: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
    paymentMethod: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    patient: {
      findFirst: vi.fn(),
    },
    invoice: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { prisma } from '@physiocore/db';
import * as paymentService from '../services/payment.service';
import * as paymentMethodService from '../services/payment-method.service';

describe('payment.service', () => {
  const tenantId = 'tenant-1';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(prisma));
  });

  describe('listPayments', () => {
    it('should return paginated payments with patient filter', async () => {
      vi.mocked(prisma.payment.findMany).mockResolvedValue([
        { id: 'pay-1', patient: {}, invoice: {}, paymentMethod: {} },
      ] as any);
      vi.mocked(prisma.payment.count).mockResolvedValue(1);

      const result = await paymentService.listPayments(tenantId, { page: 1, limit: 10, patientId: 'patient-1' });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(prisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ patientId: 'patient-1' }),
        }),
      );
    });

    it('should filter by invoiceId and status', async () => {
      vi.mocked(prisma.payment.findMany).mockResolvedValue([]);
      vi.mocked(prisma.payment.count).mockResolvedValue(0);

      await paymentService.listPayments(tenantId, { invoiceId: 'inv-1', status: 'COMPLETED' });

      expect(prisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ invoiceId: 'inv-1', status: 'COMPLETED' }),
        }),
      );
    });

    it('should filter by date range', async () => {
      vi.mocked(prisma.payment.findMany).mockResolvedValue([]);
      vi.mocked(prisma.payment.count).mockResolvedValue(0);

      await paymentService.listPayments(tenantId, { startDate: '2024-06-01', endDate: '2024-06-30' });

      expect(prisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            paidAt: expect.objectContaining({ gte: expect.any(Date), lte: expect.any(Date) }),
          }),
        }),
      );
    });
  });

  describe('recordPayment', () => {
    const baseData = { patientId: 'patient-1', amount: 500, invoiceId: 'inv-1' };

    it('should create a payment record with COMPLETED status', async () => {
      vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'patient-1' } as any);
      vi.mocked(prisma.paymentMethod.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.payment.create).mockResolvedValue({ id: 'pay-1', amount: 500, status: 'COMPLETED' } as any);
      vi.mocked(prisma.invoice.findFirst).mockResolvedValue({ id: 'inv-1', patientId: 'patient-1', total: 500, status: 'UNPAID' } as any);
      vi.mocked(prisma.payment.aggregate).mockResolvedValue({ _sum: { amount: 0 } } as any);

      const result = await paymentService.recordPayment(tenantId, baseData);

      expect(result.status).toBe('COMPLETED');
      expect(prisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tenantId, status: 'COMPLETED' }),
        }),
      );
    });

    it('should update invoice to PAID when fully paid', async () => {
      vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'patient-1' } as any);
      vi.mocked(prisma.paymentMethod.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.payment.create).mockResolvedValue({ id: 'pay-1', amount: 500 } as any);
      vi.mocked(prisma.invoice.findFirst).mockResolvedValue({ id: 'inv-1', patientId: 'patient-1', total: 500, status: 'UNPAID' } as any);
      vi.mocked(prisma.payment.aggregate).mockResolvedValue({ _sum: { amount: 0 } } as any);
      vi.mocked(prisma.invoice.update).mockResolvedValue({ id: 'inv-1', status: 'PAID' } as any);

      await paymentService.recordPayment(tenantId, baseData);

      expect(prisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv-1' },
          data: expect.objectContaining({ status: 'PAID', paidAt: expect.any(Date) }),
        }),
      );
    });

    it('should leave invoice UNPAID for partial payment', async () => {
      vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'patient-1' } as any);
      vi.mocked(prisma.paymentMethod.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.payment.create).mockResolvedValue({ id: 'pay-1', amount: 200 } as any);
      vi.mocked(prisma.invoice.findFirst).mockResolvedValue({ id: 'inv-1', patientId: 'patient-1', total: 500, status: 'UNPAID' } as any);
      vi.mocked(prisma.payment.aggregate).mockResolvedValue({ _sum: { amount: 0 } } as any);

      await paymentService.recordPayment(tenantId, { ...baseData, amount: 200 });

      expect(prisma.invoice.update).not.toHaveBeenCalled();
    });

    it('should use paymentMethod name when methodId is provided', async () => {
      vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'patient-1' } as any);
      vi.mocked(prisma.paymentMethod.findFirst).mockResolvedValue({ id: 'pm-1', name: 'Credit Card', isActive: true } as any);
      vi.mocked(prisma.payment.create).mockResolvedValue({ id: 'pay-1', methodName: 'Credit Card' } as any);
      vi.mocked(prisma.invoice.findFirst).mockResolvedValue({ id: 'inv-1', patientId: 'patient-1', total: 500 } as any);
      vi.mocked(prisma.payment.aggregate).mockResolvedValue({ _sum: { amount: 0 } } as any);
      vi.mocked(prisma.invoice.update).mockResolvedValue({} as any);

      await paymentService.recordPayment(tenantId, { ...baseData, paymentMethodId: 'pm-1' });

      expect(prisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ methodName: 'Credit Card', paymentMethodId: 'pm-1' }),
        }),
      );
    });
  });

  describe('getPaymentSummary', () => {
    it('should return totals, today collections, and breakdown by method', async () => {
      vi.mocked(prisma.payment.aggregate).mockResolvedValueOnce({ _sum: { amount: 10000 } } as any);
      vi.mocked(prisma.payment.groupBy).mockResolvedValueOnce([
        { methodName: 'Cash', _sum: { amount: 4000 }, _count: { id: 4 } },
        { methodName: 'Card', _sum: { amount: 6000 }, _count: { id: 3 } },
      ] as any);
      vi.mocked(prisma.payment.aggregate).mockResolvedValueOnce({ _sum: { amount: 500 } } as any);

      const result = await paymentService.getPaymentSummary(tenantId);

      expect(result.totalCollected).toBe(10000);
      expect(result.todayCollections).toBe(500);
      expect(result.byMethod).toHaveLength(2);
      expect(result.byMethod[0].method).toBe('Cash');
      expect(result.byMethod[0].total).toBe(4000);
      expect(result.byMethod[0].count).toBe(4);
    });

    it('should return zeros when no payments exist', async () => {
      vi.mocked(prisma.payment.aggregate).mockResolvedValueOnce({ _sum: { amount: null } } as any);
      vi.mocked(prisma.payment.groupBy).mockResolvedValueOnce([] as any);
      vi.mocked(prisma.payment.aggregate).mockResolvedValueOnce({ _sum: { amount: null } } as any);

      const result = await paymentService.getPaymentSummary(tenantId);

      expect(result.totalCollected).toBe(0);
      expect(result.todayCollections).toBe(0);
      expect(result.byMethod).toEqual([]);
    });
  });
});

describe('payment-method.service', () => {
  const tenantId = 'tenant-1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listMethods', () => {
    it('should return all payment methods for tenant', async () => {
      vi.mocked(prisma.paymentMethod.findMany).mockResolvedValue([
        { id: 'pm-1', name: 'Cash', tenantId },
      ] as any);

      const result = await paymentMethodService.listMethods(tenantId);

      expect(result).toHaveLength(1);
      expect(prisma.paymentMethod.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId } }),
      );
    });
  });

  describe('createMethod', () => {
    it('should create a new payment method', async () => {
      vi.mocked(prisma.paymentMethod.create).mockResolvedValue({ id: 'pm-1', name: 'Card', tenantId } as any);

      const result = await paymentMethodService.createMethod(tenantId, { name: 'Card', feePercentage: 2.5 });

      expect(result.id).toBe('pm-1');
      expect(prisma.paymentMethod.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tenantId, feePercent: 2.5 }),
        }),
      );
      expect(prisma.paymentMethod.create).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ feePercentage: expect.anything() }) }));
    });
  });

  describe('updateMethod', () => {
    it('should update an existing method', async () => {
      vi.mocked(prisma.paymentMethod.update).mockResolvedValue({ id: 'pm-1', name: 'Debit Card' } as any);

      const result = await paymentMethodService.updateMethod(tenantId, 'pm-1', { name: 'Debit Card', feePercentage: 1.5 });

      expect((result as any).name).toBe('Debit Card');
      expect(prisma.paymentMethod.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pm-1', tenantId },
          data: expect.objectContaining({ feePercent: 1.5 }),
        }),
      );
    });
  });

  describe('deleteMethod', () => {
    it('should delete a method', async () => {
      vi.mocked(prisma.paymentMethod.delete).mockResolvedValue({ id: 'pm-1' } as any);

      await paymentMethodService.deleteMethod(tenantId, 'pm-1');

      expect(prisma.paymentMethod.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'pm-1', tenantId } }),
      );
    });
  });
});
