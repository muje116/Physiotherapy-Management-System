import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@physiocore/db', () => ({
  prisma: {
    medicalScheme: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    schemeClaim: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    invoice: {
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    patient: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { prisma } from '@physiocore/db';
import * as medicalSchemeService from '../services/medical-scheme.service';

describe('medical-scheme.service', () => {
  const tenantId = 'tenant-1';
  const mockScheme = { id: 'scheme-1', tenantId, name: 'MediHelp', code: 'MEDI001' };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(prisma as any));
    vi.mocked(prisma.medicalScheme.findFirst).mockResolvedValue(mockScheme as any);
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'patient-1' } as any);
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue({ id: 'inv-1', patientId: 'patient-1' } as any);
    vi.mocked(prisma.schemeClaim.findFirst).mockResolvedValue({ id: 'claim-1', tenantId, status: 'DRAFT' } as any);
  });

  describe('CRUD - Schemes', () => {
    it('listSchemes should return all schemes for tenant ordered by name', async () => {
      vi.mocked(prisma.medicalScheme.findMany).mockResolvedValue([mockScheme] as any);

      const result = await medicalSchemeService.listSchemes(tenantId);

      expect(result).toHaveLength(1);
      expect(prisma.medicalScheme.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId }, orderBy: { name: 'asc' } }),
      );
    });

    it('createScheme should create a new scheme', async () => {
      vi.mocked(prisma.medicalScheme.create).mockResolvedValue(mockScheme as any);

      const result = await medicalSchemeService.createScheme(tenantId, { name: 'MediHelp', code: 'MEDI001' });

      expect(result.id).toBe('scheme-1');
      expect(prisma.medicalScheme.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ tenantId }) }),
      );
    });

    it('updateScheme should update an existing scheme', async () => {
      vi.mocked(prisma.medicalScheme.update).mockResolvedValue({ ...mockScheme, name: 'MediHelp Plus' } as any);

      const result = await medicalSchemeService.updateScheme(tenantId, 'scheme-1', { name: 'MediHelp Plus' });

      expect((result as any).name).toBe('MediHelp Plus');
      expect(prisma.medicalScheme.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'scheme-1' } }),
      );
    });

    it('deleteScheme should delete the scheme', async () => {
      vi.mocked(prisma.medicalScheme.delete).mockResolvedValue(mockScheme as any);

      await medicalSchemeService.deleteScheme(tenantId, 'scheme-1');

      expect(prisma.medicalScheme.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'scheme-1' } }),
      );
    });
  });

  describe('listClaims', () => {
    it('should return paginated claims with filters', async () => {
      vi.mocked(prisma.schemeClaim.findMany).mockResolvedValue([
        { id: 'claim-1', patient: {}, scheme: {}, invoice: {} },
      ] as any);
      vi.mocked(prisma.schemeClaim.count).mockResolvedValue(1);

      const result = await medicalSchemeService.listClaims(tenantId, { status: 'DRAFT', page: 1, limit: 10 });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(prisma.schemeClaim.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: 'DRAFT' }) }),
      );
    });

    it('should filter by schemeId and patientId', async () => {
      vi.mocked(prisma.schemeClaim.findMany).mockResolvedValue([]);
      vi.mocked(prisma.schemeClaim.count).mockResolvedValue(0);

      await medicalSchemeService.listClaims(tenantId, { schemeId: 'scheme-1', patientId: 'patient-1' });

      expect(prisma.schemeClaim.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ schemeId: 'scheme-1', patientId: 'patient-1' }),
        }),
      );
    });
  });

  describe('createClaim', () => {
    it('should create a DRAFT claim', async () => {
      vi.mocked(prisma.schemeClaim.create).mockResolvedValue({
        id: 'claim-1',
        tenantId,
        patientId: 'patient-1',
        schemeId: 'scheme-1',
        amount: 500,
        status: 'DRAFT',
      } as any);

      const result = await medicalSchemeService.createClaim(tenantId, {
        patientId: 'patient-1',
        schemeId: 'scheme-1',
        amount: 500,
      });

      expect(result.status).toBe('DRAFT');
      expect(prisma.schemeClaim.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'DRAFT' }),
        }),
      );
    });

    it('should throw when scheme not found', async () => {
      vi.mocked(prisma.medicalScheme.findFirst).mockResolvedValue(null);

      await expect(
        medicalSchemeService.createClaim(tenantId, { patientId: 'patient-1', schemeId: 'scheme-999', amount: 500 }),
      ).rejects.toThrow('Medical scheme not found');
    });
  });

  describe('submitClaim', () => {
    it('should update claim to SUBMITTED and update linked invoice', async () => {
      vi.mocked(prisma.schemeClaim.update).mockResolvedValue({
        id: 'claim-1',
        status: 'SUBMITTED',
        invoiceId: 'inv-1',
        submittedAt: new Date(),
      } as any);
      vi.mocked(prisma.invoice.update).mockResolvedValue({} as any);

      const result = await medicalSchemeService.submitClaim(tenantId, 'claim-1');

      expect(result.status).toBe('SUBMITTED');
      expect(prisma.schemeClaim.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'claim-1', tenantId },
          data: expect.objectContaining({ status: 'SUBMITTED', submittedAt: expect.any(Date) }),
        }),
      );
      expect(prisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv-1' },
          data: { status: 'SUBMITTED_TO_MEDICAL_AID' },
        }),
      );
    });

    it('should not update invoice if claim has no invoiceId', async () => {
      vi.mocked(prisma.schemeClaim.update).mockResolvedValue({
        id: 'claim-1',
        status: 'SUBMITTED',
        invoiceId: null,
      } as any);

      await medicalSchemeService.submitClaim(tenantId, 'claim-1');

      expect(prisma.invoice.update).not.toHaveBeenCalled();
    });
  });

  describe('updateClaimStatus', () => {
    beforeEach(() => {
      vi.mocked(prisma.schemeClaim.findFirst).mockResolvedValue({ id: 'claim-1', tenantId, status: 'SUBMITTED' } as any);
    });

    it('APPROVED should update invoice to MEDICAL_AID_APPROVED', async () => {
      vi.mocked(prisma.schemeClaim.update).mockResolvedValue({
        id: 'claim-1',
        status: 'APPROVED',
        invoiceId: 'inv-1',
      } as any);
      vi.mocked(prisma.invoice.update).mockResolvedValue({} as any);

      await medicalSchemeService.updateClaimStatus(tenantId, 'claim-1', 'APPROVED');

      expect(prisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv-1' },
          data: { status: 'MEDICAL_AID_APPROVED' },
        }),
      );
    });

    it('REJECTED should update invoice to MEDICAL_AID_REJECTED', async () => {
      vi.mocked(prisma.schemeClaim.update).mockResolvedValue({
        id: 'claim-1',
        status: 'REJECTED',
        invoiceId: 'inv-1',
        rejectionReason: 'Not covered',
      } as any);
      vi.mocked(prisma.invoice.update).mockResolvedValue({} as any);

      await medicalSchemeService.updateClaimStatus(tenantId, 'claim-1', 'REJECTED', 'Not covered');

      expect(prisma.schemeClaim.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'REJECTED', rejectionReason: 'Not covered' }),
        }),
      );
      expect(prisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'MEDICAL_AID_REJECTED' } }),
      );
    });

    it('PAID should update invoice to PAID', async () => {
      vi.mocked(prisma.schemeClaim.findFirst).mockResolvedValue({ id: 'claim-1', tenantId, status: 'APPROVED' } as any);
      vi.mocked(prisma.schemeClaim.update).mockResolvedValue({
        id: 'claim-1',
        status: 'PAID',
        invoiceId: 'inv-1',
      } as any);
      vi.mocked(prisma.invoice.update).mockResolvedValue({} as any);

      await medicalSchemeService.updateClaimStatus(tenantId, 'claim-1', 'PAID');

      expect(prisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'PAID' } }),
      );
    });

    it('should not update invoice if claim has no invoiceId', async () => {
      vi.mocked(prisma.schemeClaim.update).mockResolvedValue({
        id: 'claim-1',
        status: 'APPROVED',
        invoiceId: null,
      } as any);

      await medicalSchemeService.updateClaimStatus(tenantId, 'claim-1', 'APPROVED');

      expect(prisma.invoice.update).not.toHaveBeenCalled();
    });
  });

  describe('getClaimsReport', () => {
    const mockClaims = [
      { id: 'c1', amount: 1000, status: 'APPROVED', scheme: { name: 'MediHelp' } },
      { id: 'c2', amount: 500, status: 'REJECTED', scheme: { name: 'MediHelp' } },
      { id: 'c3', amount: 300, status: 'DRAFT', scheme: { name: 'Bonitas' } },
      { id: 'c4', amount: 800, status: 'PAID', scheme: { name: 'Bonitas' } },
    ];

    it('should return correct approval rate and by-scheme breakdown', async () => {
      vi.mocked(prisma.schemeClaim.findMany).mockResolvedValue(mockClaims as any);

      const result = await medicalSchemeService.getClaimsReport(tenantId);

      expect(result.totalSubmitted).toBe(3);
      expect(result.approved).toBe(2);
      expect(result.rejected).toBe(1);
      expect(result.pending).toBe(0);
      expect(result.approvalRate).toBe(67);
      expect(result.totalAmount).toBe(2600);
      expect(result.approvedAmount).toBe(1800);
      expect(result.byScheme).toHaveLength(2);
    });

    it('should return zeros when no claims exist', async () => {
      vi.mocked(prisma.schemeClaim.findMany).mockResolvedValue([]);

      const result = await medicalSchemeService.getClaimsReport(tenantId);

      expect(result.totalSubmitted).toBe(0);
      expect(result.approvalRate).toBe(0);
      expect(result.totalAmount).toBe(0);
      expect(result.byScheme).toEqual([]);
    });
  });
});
