import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@physiocore/db', () => ({
  prisma: {
    patient: {
      findFirst: vi.fn(),
    },
    treatmentPlan: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    treatmentPlanStage: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from '@physiocore/db';
import * as treatmentPlanService from '../services/treatment-plan.service';

describe('treatment-plan.service', () => {
  const tenantId = 'tenant-1';
  const mockPlan = {
    id: 'plan-1',
    tenantId,
    patientId: 'patient-1',
    title: 'Knee Rehab',
    status: 'ACTIVE',
    startDate: new Date(),
    endDate: null,
    patient: { id: 'patient-1', firstName: 'John', lastName: 'Doe' },
    stages: [
      { id: 'stage-1', planId: 'plan-1', name: 'Phase 1', order: 1, status: 'IN_PROGRESS' },
    ],
    clientTasks: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'patient-1' } as any);
    vi.mocked(prisma.treatmentPlan.findFirst).mockResolvedValue({ id: 'plan-1' } as any);
    vi.mocked(prisma.treatmentPlanStage.findFirst).mockResolvedValue({ id: 'stage-1', planId: 'plan-1' } as any);
  });

  describe('listPlans', () => {
    it('should return paginated plans with patient filter', async () => {
      vi.mocked(prisma.treatmentPlan.findMany).mockResolvedValue([mockPlan] as any);
      vi.mocked(prisma.treatmentPlan.count).mockResolvedValue(1);

      const result = await treatmentPlanService.listPlans(tenantId, { page: 1, limit: 10, patientId: 'patient-1' });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(prisma.treatmentPlan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ patientId: 'patient-1' }) }),
      );
    });

    it('should filter by status', async () => {
      vi.mocked(prisma.treatmentPlan.findMany).mockResolvedValue([]);
      vi.mocked(prisma.treatmentPlan.count).mockResolvedValue(0);

      await treatmentPlanService.listPlans(tenantId, { status: 'COMPLETED' });

      expect(prisma.treatmentPlan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: 'COMPLETED' }) }),
      );
    });

    it('should include stages ordered by order', async () => {
      vi.mocked(prisma.treatmentPlan.findMany).mockResolvedValue([]);
      vi.mocked(prisma.treatmentPlan.count).mockResolvedValue(0);

      await treatmentPlanService.listPlans(tenantId, { page: 1, limit: 20 });

      expect(prisma.treatmentPlan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({ stages: { orderBy: { order: 'asc' } } }),
        }),
      );
    });
  });

  describe('createPlan', () => {
    it('should create a plan with nested stages', async () => {
      const stagesData = [
        { name: 'Phase 1', order: 1, description: 'Initial assessment' },
        { name: 'Phase 2', order: 2, description: 'Strengthening' },
      ];

      vi.mocked(prisma.treatmentPlan.create).mockResolvedValue({
        ...mockPlan,
        stages: stagesData.map((s, i) => ({ id: `stage-${i + 1}`, ...s })),
      } as any);

      const result = await treatmentPlanService.createPlan(tenantId, {
        patientId: 'patient-1',
        title: 'Knee Rehab',
        stages: stagesData,
      });

      expect(prisma.treatmentPlan.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            stages: { create: stagesData },
          }),
        }),
      );
      expect((result as any).stages).toHaveLength(2);
    });

    it('should create a plan without stages', async () => {
      vi.mocked(prisma.treatmentPlan.create).mockResolvedValue({ ...mockPlan, stages: [] } as any);

      const result = await treatmentPlanService.createPlan(tenantId, {
        patientId: 'patient-1',
        title: 'Knee Rehab',
      });

      expect(result!.id).toBe('plan-1');
      expect(prisma.treatmentPlan.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tenantId, patientId: 'patient-1' }),
        }),
      );
    });
  });

  describe('getPlan', () => {
    it('should return plan with stages and clientTasks', async () => {
      vi.mocked(prisma.treatmentPlan.findUnique).mockResolvedValue(mockPlan as any);

      const result = await treatmentPlanService.getPlan(tenantId, 'plan-1');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('plan-1');
      expect(prisma.treatmentPlan.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'plan-1', tenantId },
          include: expect.objectContaining({
            patient: true,
            stages: { orderBy: { order: 'asc' } },
            clientTasks: { orderBy: { createdAt: 'desc' } },
          }),
        }),
      );
    });

    it('should return null when plan not found', async () => {
      vi.mocked(prisma.treatmentPlan.findUnique).mockResolvedValue(null);

      const result = await treatmentPlanService.getPlan(tenantId, 'plan-999');

      expect(result).toBeNull();
    });
  });

  describe('updatePlan', () => {
    it('should update an existing plan', async () => {
      vi.mocked(prisma.treatmentPlan.update).mockResolvedValue({ ...mockPlan, title: 'Updated Rehab' } as any);

      const result = await treatmentPlanService.updatePlan(tenantId, 'plan-1', { title: 'Updated Rehab' });

      expect((result as any).title).toBe('Updated Rehab');
      expect(prisma.treatmentPlan.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'plan-1', tenantId } }),
      );
    });

    it('should reject updates for a plan from another tenant', async () => {
      vi.mocked(prisma.treatmentPlan.findFirst).mockResolvedValue(null);

      await expect(
        treatmentPlanService.updatePlan(tenantId, 'plan-999', { title: 'Updated Rehab' }),
      ).rejects.toThrow('Treatment plan not found');
    });
  });

  describe('addStage', () => {
    it('should create a new stage linked to the plan', async () => {
      vi.mocked(prisma.treatmentPlanStage.create).mockResolvedValue({
        id: 'stage-3',
        planId: 'plan-1',
        name: 'Phase 3',
        order: 3,
      } as any);

      const result = await treatmentPlanService.addStage(tenantId, 'plan-1', {
        name: 'Phase 3',
        order: 3,
      });

      expect((result as any).planId).toBe('plan-1');
      expect(prisma.treatmentPlanStage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ planId: 'plan-1' }),
        }),
      );
    });

    it('should reject a stage for a plan from another tenant', async () => {
      vi.mocked(prisma.treatmentPlan.findFirst).mockResolvedValue(null);

      await expect(
        treatmentPlanService.addStage(tenantId, 'plan-999', { name: 'Phase 3' }),
      ).rejects.toThrow('Treatment plan not found');
    });
  });

  describe('updateStage', () => {
    it('should update a stage scoped by planId', async () => {
      vi.mocked(prisma.treatmentPlanStage.update).mockResolvedValue({
        id: 'stage-1',
        planId: 'plan-1',
        status: 'COMPLETED',
      } as any);

      const result = await treatmentPlanService.updateStage(tenantId, 'plan-1', 'stage-1', { status: 'COMPLETED' });

      expect((result as any).status).toBe('COMPLETED');
      expect(prisma.treatmentPlanStage.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'stage-1', planId: 'plan-1' } }),
      );
    });

    it('should reject a stage that is not linked to the tenant plan', async () => {
      vi.mocked(prisma.treatmentPlanStage.findFirst).mockResolvedValue(null);

      await expect(
        treatmentPlanService.updateStage(tenantId, 'plan-1', 'stage-999', { progress: 50 }),
      ).rejects.toThrow('Treatment plan stage not found');
    });
  });

  describe('completePlan', () => {
    it('should set status to COMPLETED and set endDate', async () => {
      vi.mocked(prisma.treatmentPlan.update).mockResolvedValue({
        ...mockPlan,
        status: 'COMPLETED',
        endDate: new Date(),
      } as any);

      const result = await treatmentPlanService.completePlan(tenantId, 'plan-1');

      expect((result as any).status).toBe('COMPLETED');
      expect((result as any).endDate).toBeDefined();
      expect(prisma.treatmentPlan.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'plan-1', tenantId },
          data: { status: 'COMPLETED', endDate: expect.any(Date) },
        }),
      );
    });

    it('should reject completing a plan from another tenant', async () => {
      vi.mocked(prisma.treatmentPlan.findFirst).mockResolvedValue(null);

      await expect(treatmentPlanService.completePlan(tenantId, 'plan-999')).rejects.toThrow('Treatment plan not found');
    });
  });
});
