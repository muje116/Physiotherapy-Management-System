import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@physiocore/db', () => ({
  prisma: {
    invoice: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    patient: {
      findFirst: vi.fn(),
    },
    appointment: {
      findFirst: vi.fn(),
    },
    payment: {
      aggregate: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  InvoiceStatus: {
    UNPAID: 'UNPAID',
    PAID: 'PAID',
    SUBMITTED_TO_MEDICAL_AID: 'SUBMITTED_TO_MEDICAL_AID',
    OVERDUE: 'OVERDUE',
    MEDICAL_AID_APPROVED: 'MEDICAL_AID_APPROVED',
    MEDICAL_AID_REJECTED: 'MEDICAL_AID_REJECTED',
    VOID: 'VOID',
  },
}));

vi.mock('../utils/helpers', () => ({
  calculateVat: vi.fn((amount: number) => ({
    subtotal: Math.round(amount * 100) / 100,
    vatAmount: Math.round(amount * 0.15 * 100) / 100,
    total: Math.round(amount * 1.15 * 100) / 100,
  })),
  sanitizeInput: vi.fn((s: string) => s),
}));

vi.mock('../services/payment.service', () => ({
  recordPayment: vi.fn(),
}));

vi.mock('../queues/invoice.queue', () => ({
  invoiceQueue: { add: vi.fn() },
}));

import { prisma, InvoiceStatus } from '@physiocore/db';
import * as invoiceService from '../services/invoice.service';
import { recordPayment } from '../services/payment.service';

describe('invoice.service', () => {
  const tenantId = 'tenant-1';
  const mockInvoice = {
    id: 'inv-1',
    tenantId,
    invoiceNumber: 'INV-202406-00001',
    patientId: 'patient-1',
    appointmentId: null,
    lineItems: [{ description: 'Consultation', qty: 1, unitPrice: 500, total: 500 }],
    subtotal: 500,
    vatAmount: 75,
    total: 575,
    status: InvoiceStatus.UNPAID,
    dueDate: null,
    paidAt: null,
    paymentMethod: null,
    medicalAidClaim: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'patient-1' } as any);
    vi.mocked(prisma.payment.aggregate).mockResolvedValue({ _sum: { amount: 0 } } as any);
    vi.mocked(recordPayment).mockResolvedValue({ id: 'pay-1' } as any);
  });

  describe('list', () => {
    it('should return paginated invoices with status filter', async () => {
      vi.mocked(prisma.invoice.findMany).mockResolvedValue([
        { ...mockInvoice, patient: { firstName: 'John' }, appointment: null },
      ] as any);
      vi.mocked(prisma.invoice.count).mockResolvedValue(1);

      const result = await invoiceService.list(tenantId, { page: 1, limit: 10, status: InvoiceStatus.UNPAID });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId, status: InvoiceStatus.UNPAID }),
        }),
      );
    });

    it('should filter by patient and date range', async () => {
      vi.mocked(prisma.invoice.findMany).mockResolvedValue([]);
      vi.mocked(prisma.invoice.count).mockResolvedValue(0);

      await invoiceService.list(tenantId, {
        page: 1,
        limit: 10,
        patientId: 'patient-1',
        startDate: '2024-06-01',
        endDate: '2024-06-30',
      });

      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            patientId: 'patient-1',
            createdAt: expect.objectContaining({ gte: expect.any(Date), lte: expect.any(Date) }),
          }),
        }),
      );
    });
  });

  describe('create', () => {
    it('should create an invoice with generated number and calculated totals', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => {
        const tx = {
          invoice: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        };
        return cb(tx);
      });
      vi.mocked(prisma.invoice.create).mockResolvedValue({
        ...mockInvoice,
        patient: { id: 'patient-1', firstName: 'John', lastName: 'Doe', patientCode: 'P-00001' },
      } as any);

      const result = await invoiceService.create(tenantId, {
        patientId: 'patient-1',
        lineItems: [{ description: 'Consultation', qty: 1, unitPrice: 500, total: 500 }],
      });

      expect(result.invoiceNumber).toBe('INV-202406-00001');
      expect(result.total).toBe(575);
    });

    it('should calculate totals from line items', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => {
        const tx = {
          invoice: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        };
        return cb(tx);
      });
      vi.mocked(prisma.invoice.create).mockResolvedValue({ ...mockInvoice, patient: {} } as any);
      const { calculateVat } = await import('../utils/helpers');

      await invoiceService.create(tenantId, {
        patientId: 'patient-1',
        lineItems: [
          { description: 'Item 1', qty: 2, unitPrice: 100, total: 200 },
          { description: 'Item 2', qty: 1, unitPrice: 300, total: 300 },
        ],
      });

      expect(calculateVat).toHaveBeenCalledWith(500);
    });

    it('should increment invoice number from last invoice', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => {
        const tx = {
          invoice: {
            findFirst: vi.fn().mockResolvedValue({ invoiceNumber: 'INV-202406-00001' }),
          },
        };
        return cb(tx);
      });
      vi.mocked(prisma.invoice.create).mockResolvedValue({ ...mockInvoice, invoiceNumber: 'INV-202406-00002', patient: {} } as any);

      const result = await invoiceService.create(tenantId, {
        patientId: 'patient-1',
        lineItems: [{ description: 'Test', qty: 1, unitPrice: 100, total: 100 }],
      });

      expect(result.invoiceNumber).toBe('INV-202406-00002');
    });
  });

  describe('getById', () => {
    it('should return invoice by id within tenant', async () => {
      vi.mocked(prisma.invoice.findFirst).mockResolvedValue({
        ...mockInvoice,
        patient: {},
        appointment: null,
      } as any);

      const result = await invoiceService.getById(tenantId, 'inv-1');
      expect(result.id).toBe('inv-1');
    });

    it('should throw NotFoundError for non-existent invoice', async () => {
      vi.mocked(prisma.invoice.findFirst).mockResolvedValue(null);

      await expect(invoiceService.getById(tenantId, 'inv-999')).rejects.toThrow('Invoice not found');
    });
  });

  describe('update', () => {
    it('should update invoice and recalculate totals when lineItems change', async () => {
      vi.mocked(prisma.invoice.findFirst).mockResolvedValue(mockInvoice as any);
      vi.mocked(prisma.invoice.update).mockResolvedValue({ ...mockInvoice, status: InvoiceStatus.OVERDUE } as any);

      const result = await invoiceService.update(tenantId, 'inv-1', { status: InvoiceStatus.OVERDUE });

      expect((result as any).status).toBe(InvoiceStatus.OVERDUE);
    });

    it('should recalculate VAT on lineItems update', async () => {
      vi.mocked(prisma.invoice.findFirst).mockResolvedValue(mockInvoice as any);
      vi.mocked(prisma.invoice.update).mockResolvedValue({} as any);
      const { calculateVat } = await import('../utils/helpers');

      await invoiceService.update(tenantId, 'inv-1', {
        lineItems: [{ description: 'New', qty: 1, unitPrice: 1000, total: 1000 }],
      });

      expect(calculateVat).toHaveBeenCalledWith(1000);
    });

    it('should throw NotFoundError for non-existent', async () => {
      vi.mocked(prisma.invoice.findFirst).mockResolvedValue(null);

      await expect(invoiceService.update(tenantId, 'inv-999', { status: InvoiceStatus.PAID })).rejects.toThrow('Invoice not found');
    });

    it('should require the payment workflow before marking an invoice paid', async () => {
      vi.mocked(prisma.invoice.findFirst).mockResolvedValue(mockInvoice as any);

      await expect(invoiceService.update(tenantId, 'inv-1', { status: InvoiceStatus.PAID }))
        .rejects.toThrow('Use the payment endpoint to mark an invoice as paid');
      expect(prisma.invoice.update).not.toHaveBeenCalled();
    });
  });

  describe('markPaid', () => {
    it('should mark invoice as paid with payment method', async () => {
      vi.mocked(prisma.invoice.findFirst).mockResolvedValue(mockInvoice as any);

      const result = await invoiceService.markPaid(tenantId, 'inv-1', 'CARD');

      expect(recordPayment).toHaveBeenCalledWith(
        tenantId,
        expect.objectContaining({
          patientId: 'patient-1',
          invoiceId: 'inv-1',
          amount: 575,
          methodName: 'CARD',
        }),
      );
      expect(result.id).toBe('inv-1');
    });

    it('should throw NotFoundError for non-existent', async () => {
      vi.mocked(prisma.invoice.findFirst).mockResolvedValue(null);

      await expect(invoiceService.markPaid(tenantId, 'inv-999')).rejects.toThrow('Invoice not found');
    });
  });

  describe('submitToMedicalAid', () => {
    it('should update status to SUBMITTED_TO_MEDICAL_AID', async () => {
      vi.mocked(prisma.invoice.findFirst).mockResolvedValue({
        ...mockInvoice,
        medicalAidClaim: { scheme: 'MediHelp', membershipNo: 'MEM123' },
      } as any);
      vi.mocked(prisma.invoice.update).mockResolvedValue({ ...mockInvoice, status: InvoiceStatus.SUBMITTED_TO_MEDICAL_AID } as any);

      const result = await invoiceService.submitToMedicalAid(tenantId, 'inv-1');

      expect((result as any).status).toBe(InvoiceStatus.SUBMITTED_TO_MEDICAL_AID);
    });

    it('should throw NotFoundError when no medicalAidClaim data exists', async () => {
      vi.mocked(prisma.invoice.findFirst).mockResolvedValue(mockInvoice as any);

      await expect(invoiceService.submitToMedicalAid(tenantId, 'inv-1')).rejects.toThrow('Invoice has no medical aid claim data');
    });
  });

  describe('getMedicalAidClaims', () => {
    it('should return invoices with medical aid claims', async () => {
      vi.mocked(prisma.invoice.findMany).mockResolvedValue([
        { ...mockInvoice, medicalAidClaim: { scheme: 'MediHelp' }, patient: {} },
      ] as any);
      vi.mocked(prisma.invoice.count).mockResolvedValue(1);

      const result = await invoiceService.getMedicalAidClaims(tenantId, { page: 1, limit: 10 });

      expect(result.items).toHaveLength(1);
      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            medicalAidClaim: { not: null },
          }),
        }),
      );
    });
  });

  describe('updateClaimStatus', () => {
    it('updates claim metadata and the linked invoice status', async () => {
      vi.mocked(prisma.invoice.findFirst).mockResolvedValue({
        ...mockInvoice,
        status: InvoiceStatus.SUBMITTED_TO_MEDICAL_AID,
        medicalAidClaim: { fundName: 'MediHelp', status: 'SUBMITTED' },
      } as any);
      vi.mocked(prisma.invoice.update).mockResolvedValue({ ...mockInvoice, status: InvoiceStatus.MEDICAL_AID_APPROVED } as any);

      await invoiceService.updateClaimStatus(tenantId, 'inv-1', 'APPROVED');

      expect(prisma.invoice.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'inv-1' },
        data: expect.objectContaining({
          status: InvoiceStatus.MEDICAL_AID_APPROVED,
          medicalAidClaim: { fundName: 'MediHelp', status: 'APPROVED' },
        }),
      }));
    });

    it('rejects a claim response when there is no claim data', async () => {
      vi.mocked(prisma.invoice.findFirst).mockResolvedValue(mockInvoice as any);

      await expect(invoiceService.updateClaimStatus(tenantId, 'inv-1', 'APPROVED'))
        .rejects.toThrow('Invoice has no medical aid claim data');
    });
  });
});
