import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@physiocore/db', () => ({
  prisma: {
    patient: { findMany: vi.fn() },
    payment: { findMany: vi.fn() },
    invoice: { findMany: vi.fn() },
  },
  AppointmentStatus: {
    COMPLETED: 'COMPLETED',
    NO_SHOW: 'NO_SHOW',
  },
  InvoiceStatus: {
    UNPAID: 'UNPAID',
    PAID: 'PAID',
    OVERDUE: 'OVERDUE',
  },
}));

import { prisma } from '@physiocore/db';
import * as reportService from '../services/report.service';

describe('report.service', () => {
  const tenantId = 'tenant-1';
  const dateRange = {
    startDate: '2026-01-01T00:00:00.000Z',
    endDate: '2026-01-31T23:59:59.999Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPatientReport', () => {
    it('aggregates member activity and preferred payment methods', async () => {
      vi.mocked(prisma.patient.findMany).mockResolvedValue([
        {
          id: 'patient-1',
          patientCode: 'P-00001',
          firstName: 'Jane',
          lastName: 'Doe',
          gender: 'FEMALE',
          dateOfBirth: new Date('1990-01-01'),
          paymentMethod: 'CASH',
          medicalAidName: null,
          isActive: true,
          createdAt: new Date('2026-01-05'),
          appointments: [{ id: 'appointment-1', status: 'COMPLETED' }, { id: 'appointment-2', status: 'NO_SHOW' }],
          payments: [{ id: 'payment-1', amount: 500, status: 'COMPLETED', paidAt: new Date('2026-01-10'), methodName: 'Cash' }],
          invoices: [{ total: 250, status: 'UNPAID' }],
        },
        {
          id: 'patient-2',
          patientCode: 'P-00002',
          firstName: 'John',
          lastName: 'Smith',
          gender: 'MALE',
          dateOfBirth: new Date('1985-05-10'),
          paymentMethod: 'INSURANCE',
          medicalAidName: 'Discovery Health',
          isActive: false,
          createdAt: new Date('2025-12-20'),
          appointments: [],
          payments: [],
          invoices: [{ total: 100, status: 'OVERDUE' }],
        },
      ] as any);

      const result = await reportService.getPatientReport(tenantId, dateRange);

      expect(prisma.patient.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId } }));
      expect(result.summary).toMatchObject({
        totalMembers: 2,
        activeMembers: 1,
        inactiveMembers: 1,
        newMembers: 1,
        membersSeen: 1,
        membersWithPayments: 1,
        totalCollected: 500,
        totalOutstanding: 350,
      });
      expect(result.byPreferredPaymentMethod).toEqual(expect.arrayContaining([
        expect.objectContaining({ method: 'CASH', memberCount: 1, collectedAmount: 500 }),
        expect.objectContaining({ method: 'INSURANCE', memberCount: 1, collectedAmount: 0 }),
      ]));
      expect(result.byCoverage).toEqual(expect.arrayContaining([
        expect.objectContaining({ coverage: 'Self-pay / not recorded', memberCount: 1 }),
        expect.objectContaining({ coverage: 'Discovery Health', memberCount: 1, outstandingBalance: 100 }),
      ]));
    });

    it('applies member filters while keeping the tenant scope', async () => {
      vi.mocked(prisma.patient.findMany).mockResolvedValue([] as any);

      await reportService.getPatientReport(tenantId, dateRange, {
        paymentMethod: 'CASH',
        memberStatus: 'ACTIVE',
      });

      expect(prisma.patient.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { tenantId, paymentMethod: 'CASH', isActive: true },
      }));
    });
  });

  describe('getPaymentReport', () => {
    it('summarizes payments by status, member, and recorded method', async () => {
      vi.mocked(prisma.payment.findMany).mockResolvedValue([
        {
          id: 'payment-1',
          patientId: 'patient-1',
          amount: 500,
          methodName: 'Cash',
          status: 'COMPLETED',
          paidAt: new Date('2026-01-10T10:00:00.000Z'),
          reference: 'REC-1',
          notes: null,
          patient: { id: 'patient-1', patientCode: 'P-00001', firstName: 'Jane', lastName: 'Doe' },
          invoice: { id: 'invoice-1', invoiceNumber: 'INV-001' },
        },
        {
          id: 'payment-2',
          patientId: 'patient-2',
          amount: 125,
          methodName: 'Card',
          status: 'PENDING',
          paidAt: new Date('2026-01-11T10:00:00.000Z'),
          reference: null,
          notes: null,
          patient: { id: 'patient-2', patientCode: 'P-00002', firstName: 'John', lastName: 'Smith' },
          invoice: null,
        },
        {
          id: 'payment-3',
          patientId: 'patient-1',
          amount: 50,
          methodName: 'Cash',
          status: 'REFUNDED',
          paidAt: new Date('2026-01-12T10:00:00.000Z'),
          reference: 'REF-1',
          notes: 'Duplicate payment',
          patient: { id: 'patient-1', patientCode: 'P-00001', firstName: 'Jane', lastName: 'Doe' },
          invoice: { id: 'invoice-1', invoiceNumber: 'INV-001' },
        },
      ] as any);
      vi.mocked(prisma.invoice.findMany).mockResolvedValue([
        { total: 600, status: 'PAID', createdAt: new Date('2026-01-01'), paidAt: new Date('2026-01-10') },
        { total: 300, status: 'UNPAID', createdAt: new Date('2026-01-15'), paidAt: null },
      ] as any);

      const result = await reportService.getPaymentReport(tenantId, dateRange);

      expect(prisma.payment.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { tenantId, paidAt: { gte: new Date(dateRange.startDate), lte: new Date(dateRange.endDate) } },
      }));
      expect(result.summary).toMatchObject({
        transactionCount: 3,
        completedTransactions: 1,
        pendingTransactions: 1,
        refundedTransactions: 1,
        membersPaid: 1,
        collectedAmount: 500,
        refundedAmount: 50,
        netCollected: 450,
        pendingAmount: 125,
        totalBilled: 900,
        outstandingBalance: 300,
        collectionRate: 55.6,
      });
      expect(result.byMethod).toEqual(expect.arrayContaining([
        expect.objectContaining({ method: 'Cash', transactionCount: 2, patientCount: 1, completedAmount: 500, refundedAmount: 50, netAmount: 450 }),
        expect.objectContaining({ method: 'Card', transactionCount: 1, patientCount: 1, completedAmount: 0 }),
      ]));
      expect(result.payments[0]).toMatchObject({ patientName: 'Jane Doe', invoiceNumber: 'INV-001', amount: 500 });
    });

    it('applies payment filters and tenant scope', async () => {
      vi.mocked(prisma.payment.findMany).mockResolvedValue([] as any);
      vi.mocked(prisma.invoice.findMany).mockResolvedValue([] as any);

      await reportService.getPaymentReport(tenantId, dateRange, { paymentMethod: 'Cash', status: 'COMPLETED' });

      expect(prisma.payment.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ tenantId, methodName: 'Cash', status: 'COMPLETED' }),
      }));
    });
  });

  describe('getMedicalSchemePaymentReport', () => {
    it('groups completed medical scheme collections by scheme and keeps unlinked patients visible', async () => {
      vi.mocked(prisma.payment.findMany).mockResolvedValue([
        {
          id: 'payment-scheme-1',
          patientId: 'patient-1',
          amount: 800,
          methodName: 'Medical Aid',
          status: 'COMPLETED',
          paidAt: new Date('2026-01-10T10:00:00.000Z'),
          reference: 'SCHEME-1',
          patient: {
            id: 'patient-1', patientCode: 'P-00001', firstName: 'Jane', lastName: 'Doe', medicalAidName: 'Discovery Health', medicalAidNo: 'DH-1',
          },
          invoice: {
            id: 'invoice-1', invoiceNumber: 'INV-001',
            schemeClaims: [{ claimReference: 'CLM-1', status: 'PAID', scheme: { id: 'scheme-1', name: 'Discovery Health', code: 'DISC' } }],
          },
          paymentMethod: { name: 'Medical Aid', type: 'MEDICAL_AID' },
        },
        {
          id: 'payment-scheme-2',
          patientId: 'patient-2',
          amount: 450,
          methodName: 'Medical Aid',
          status: 'COMPLETED',
          paidAt: new Date('2026-01-11T10:00:00.000Z'),
          reference: null,
          patient: {
            id: 'patient-2', patientCode: 'P-00002', firstName: 'John', lastName: 'Smith', medicalAidName: 'Momentum', medicalAidNo: 'MO-2',
          },
          invoice: { id: 'invoice-2', invoiceNumber: 'INV-002', schemeClaims: [] },
          paymentMethod: { name: 'Medical Aid', type: 'MEDICAL_AID' },
        },
        {
          id: 'payment-self-pay',
          patientId: 'patient-3',
          amount: 300,
          methodName: 'Cash',
          status: 'COMPLETED',
          paidAt: new Date('2026-01-12T10:00:00.000Z'),
          reference: 'CASH-1',
          patient: {
            id: 'patient-3', patientCode: 'P-00003', firstName: 'Mary', lastName: 'Jones', medicalAidName: 'Momentum', medicalAidNo: 'MO-3',
          },
          invoice: { id: 'invoice-3', invoiceNumber: 'INV-003', schemeClaims: [] },
          paymentMethod: { name: 'Cash', type: 'CASH' },
        },
      ] as any);

      const result = await reportService.getMedicalSchemePaymentReport(tenantId, dateRange);

      expect(prisma.payment.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ tenantId, status: 'COMPLETED' }),
      }));
      expect(result.summary).toEqual({ transactionCount: 2, patientCount: 2, schemeCount: 2, collectedAmount: 1250 });
      expect(result.byScheme).toEqual(expect.arrayContaining([
        expect.objectContaining({ scheme: 'Discovery Health', patientCount: 1, collectedAmount: 800 }),
        expect.objectContaining({ scheme: 'Momentum', patientCount: 1, collectedAmount: 450 }),
      ]));
      expect(result.patients[0]).toMatchObject({ scheme: 'Discovery Health', claimReference: 'CLM-1', amount: 800 });
    });
  });
});
