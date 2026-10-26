import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@physiocore/db', () => ({
  prisma: {
    therapist: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    appointment: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    scheduleBlock: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    patient: {
      findMany: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
    },
    tenantSettings: {
      findUnique: vi.fn(),
    },
  },
  Role: {
    SUPER_ADMIN: 'SUPER_ADMIN',
    ADMIN: 'ADMIN',
    THERAPIST: 'THERAPIST',
    FRONT_DESK: 'FRONT_DESK',
    BILLING: 'BILLING',
    PATIENT: 'PATIENT',
  },
}));

import { prisma, Role } from '@physiocore/db';
import * as therapistService from '../services/therapist.service';
import { NotFoundError, ConflictError, ValidationError } from '../utils/errors';

describe('therapist.service', () => {
  const tenantId = 'tenant-1';
  const mockTherapist = {
    id: 'therapist-1',
    tenantId,
    userId: 'user-1',
    registrationNo: 'HPCSA-123',
    specialties: ['Orthopaedic'],
    bio: 'Experienced therapist',
    avatarUrl: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('list', () => {
    it('should return therapists with utilisation stats', async () => {
      vi.mocked(prisma.therapist.findMany).mockResolvedValue([
        {
          ...mockTherapist,
          user: { id: 'user-1', firstName: 'Dr', lastName: 'Smith', email: 'dr@test.com', role: Role.THERAPIST, isActive: true },
          _count: { appointments: 10, patients: 5 },
        },
      ] as any);
      vi.mocked(prisma.appointment.count).mockResolvedValue(50);

      const result = await therapistService.list(tenantId);

      expect(result).toHaveLength(1);
      expect(result[0].utilisation).toBe(20);
      expect(result[0]._count.appointments).toBe(10);
    });

    it('should return utilisation as 0 when no appointments', async () => {
      vi.mocked(prisma.therapist.findMany).mockResolvedValue([
        {
          ...mockTherapist,
          user: {},
          _count: { appointments: 0, patients: 0 },
        },
      ] as any);
      vi.mocked(prisma.appointment.count).mockResolvedValue(0);

      const result = await therapistService.list(tenantId);

      expect(result[0].utilisation).toBe(0);
    });
  });

  describe('create', () => {
    it('should create a new therapist profile', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'user-1', tenantId, role: Role.THERAPIST, isActive: true } as any);
      vi.mocked(prisma.therapist.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.therapist.create).mockResolvedValue({
        ...mockTherapist,
        user: { id: 'user-1', firstName: 'Dr', lastName: 'Smith', email: 'dr@test.com', role: Role.THERAPIST },
      } as any);

      const result = await therapistService.create(tenantId, { userId: 'user-1', registrationNo: 'HPCSA-123', specialties: ['Orthopaedic'] });

      expect(result.id).toBe('therapist-1');
      expect(prisma.therapist.create).toHaveBeenCalled();
    });

    it('should throw NotFoundError when user not found in tenant', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

      await expect(therapistService.create(tenantId, { userId: 'user-999' })).rejects.toThrow('User not found in this tenant');
    });

    it('should throw ConflictError when user already has therapist profile', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'user-1', tenantId, role: Role.THERAPIST, isActive: true } as any);
      vi.mocked(prisma.therapist.findUnique).mockResolvedValue({ id: 'existing' } as any);

      await expect(therapistService.create(tenantId, { userId: 'user-1' })).rejects.toThrow('User already has a therapist profile');
    });
  });

  describe('getById', () => {
    it('should return therapist with full profile', async () => {
      vi.mocked(prisma.therapist.findFirst).mockResolvedValue({
        ...mockTherapist,
        user: { id: 'user-1', firstName: 'Dr', lastName: 'Smith', email: 'dr@test.com', role: Role.THERAPIST, isActive: true },
        scheduleBlocks: [],
        _count: { patients: 5, appointments: 10 },
      } as any);

      const result = await therapistService.getById(tenantId, 'therapist-1');

      expect(result.id).toBe('therapist-1');
      expect(result._count.patients).toBe(5);
    });

    it('should throw NotFoundError for non-existent therapist', async () => {
      vi.mocked(prisma.therapist.findFirst).mockResolvedValue(null);

      await expect(therapistService.getById(tenantId, 'therapist-999')).rejects.toThrow('Therapist not found');
    });
  });

  describe('update', () => {
    it('should update therapist fields', async () => {
      vi.mocked(prisma.therapist.findFirst).mockResolvedValue(mockTherapist as any);
      vi.mocked(prisma.therapist.update).mockResolvedValue({ ...mockTherapist, bio: 'Updated bio' } as any);

      const result = await therapistService.update(tenantId, 'therapist-1', { bio: 'Updated bio' });

      expect((result as any).bio).toBe('Updated bio');
    });

    it('should throw NotFoundError for non-existent', async () => {
      vi.mocked(prisma.therapist.findFirst).mockResolvedValue(null);

      await expect(therapistService.update(tenantId, 'therapist-999', { bio: 'test' })).rejects.toThrow('Therapist not found');
    });
  });

  describe('getSchedule', () => {
    it('should return schedule blocks within date range', async () => {
      vi.mocked(prisma.therapist.findFirst).mockResolvedValue({ id: 'therapist-1' } as any);
      vi.mocked(prisma.scheduleBlock.findMany).mockResolvedValue([
        { id: 'block-1', startAt: new Date('2024-06-01'), endAt: new Date('2024-06-01') },
      ] as any);

      const result = await therapistService.getSchedule(tenantId, 'therapist-1', '2024-06-01', '2024-06-30');

      expect(result).toHaveLength(1);
      expect(prisma.scheduleBlock.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId,
            therapistId: 'therapist-1',
            startAt: { gte: expect.any(Date) },
            endAt: { lte: expect.any(Date) },
          },
        }),
      );
    });

    it('should reject a therapist from another tenant', async () => {
      vi.mocked(prisma.therapist.findFirst).mockResolvedValue(null);

      await expect(
        therapistService.getSchedule(tenantId, 'therapist-999', '2024-06-01', '2024-06-30'),
      ).rejects.toThrow('Therapist not found');
    });

    it('should reject an invalid date range', async () => {
      vi.mocked(prisma.therapist.findFirst).mockResolvedValue({ id: 'therapist-1' } as any);

      await expect(
        therapistService.getSchedule(tenantId, 'therapist-1', '2024-06-30', '2024-06-01'),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('addScheduleBlock', () => {
    it('should add a schedule block', async () => {
      vi.mocked(prisma.therapist.findFirst).mockResolvedValue(mockTherapist as any);
      vi.mocked(prisma.scheduleBlock.create).mockResolvedValue({
        id: 'block-1',
        tenantId,
        therapistId: 'therapist-1',
        startAt: new Date('2024-06-01T12:00:00Z'),
        endAt: new Date('2024-06-01T13:00:00Z'),
        type: 'BREAK',
        label: 'Lunch',
      } as any);

      const result = await therapistService.addScheduleBlock(tenantId, 'therapist-1', {
        startAt: '2024-06-01T12:00:00Z',
        endAt: '2024-06-01T13:00:00Z',
        type: 'BREAK',
        label: 'Lunch',
      });

      expect(result.id).toBe('block-1');
    });

    it('should reject an invalid schedule block range', async () => {
      vi.mocked(prisma.therapist.findFirst).mockResolvedValue(mockTherapist as any);

      await expect(
        therapistService.addScheduleBlock(tenantId, 'therapist-1', {
          startAt: '2024-06-01T13:00:00Z',
          endAt: '2024-06-01T12:00:00Z',
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('should default type to AVAILABLE', async () => {
      vi.mocked(prisma.therapist.findFirst).mockResolvedValue(mockTherapist as any);
      vi.mocked(prisma.scheduleBlock.create).mockResolvedValue({} as any);

      await therapistService.addScheduleBlock(tenantId, 'therapist-1', {
        startAt: '2024-06-01T12:00:00Z',
        endAt: '2024-06-01T13:00:00Z',
      });

      expect(prisma.scheduleBlock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'AVAILABLE' }),
        }),
      );
    });

    it('should throw NotFoundError if therapist not found', async () => {
      vi.mocked(prisma.therapist.findFirst).mockResolvedValue(null);

      await expect(
        therapistService.addScheduleBlock(tenantId, 'therapist-999', {
          startAt: '2024-06-01T12:00:00Z',
          endAt: '2024-06-01T13:00:00Z',
        }),
      ).rejects.toThrow('Therapist not found');
    });
  });

  describe('removeScheduleBlock', () => {
    it('should remove a schedule block', async () => {
      vi.mocked(prisma.scheduleBlock.findFirst).mockResolvedValue({ id: 'block-1', therapistId: 'therapist-1', tenantId } as any);
      vi.mocked(prisma.scheduleBlock.delete).mockResolvedValue({} as any);

      await therapistService.removeScheduleBlock(tenantId, 'therapist-1', 'block-1');

      expect(prisma.scheduleBlock.delete).toHaveBeenCalledWith({ where: { id: 'block-1' } });
    });

    it('should throw NotFoundError if block not found', async () => {
      vi.mocked(prisma.scheduleBlock.findFirst).mockResolvedValue(null);

      await expect(therapistService.removeScheduleBlock(tenantId, 'therapist-1', 'block-999')).rejects.toThrow('Schedule block not found');
    });
  });

  describe('getPatients', () => {
    it('should return active patients assigned to therapist', async () => {
      vi.mocked(prisma.therapist.findFirst).mockResolvedValue({ id: 'therapist-1' } as any);
      vi.mocked(prisma.patient.findMany).mockResolvedValue([
        { id: 'patient-1', isActive: true, _count: { appointments: 0, invoices: 0 } },
      ] as any);

      const result = await therapistService.getPatients(tenantId, 'therapist-1');

      expect(result).toHaveLength(1);
      expect(prisma.patient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            therapists: { some: { therapistId: 'therapist-1' } },
            isActive: true,
          }),
        }),
      );
    });

    it('should reject a therapist from another tenant', async () => {
      vi.mocked(prisma.therapist.findFirst).mockResolvedValue(null);

      await expect(therapistService.getPatients(tenantId, 'therapist-999')).rejects.toThrow('Therapist not found');
    });
  });

  describe('getUtilisation', () => {
    it('should calculate utilisation percentage', async () => {
      vi.mocked(prisma.therapist.findFirst).mockResolvedValue({ id: 'therapist-1' } as any);
      vi.mocked(prisma.tenantSettings.findUnique).mockResolvedValue({
        workingHoursStart: '09:00',
        workingHoursEnd: '17:00',
        workingDays: [1, 2, 3, 4, 5],
      } as any);
      vi.mocked(prisma.appointment.findMany).mockResolvedValue([
        { startAt: new Date('2024-06-03T09:00:00Z'), endAt: new Date('2024-06-03T09:45:00Z') },
        { startAt: new Date('2024-06-03T10:00:00Z'), endAt: new Date('2024-06-03T10:45:00Z') },
      ] as any);

      const result = await therapistService.getUtilisation(tenantId, 'therapist-1', '2024-06-03', '2024-06-07');

      expect(result).toHaveProperty('totalAvailableMinutes');
      expect(result).toHaveProperty('bookedMinutes');
      expect(result).toHaveProperty('utilisation');
      expect(result.bookedMinutes).toBe(90);
    });

    it('should return 0 utilisation when no available time', async () => {
      vi.mocked(prisma.therapist.findFirst).mockResolvedValue({ id: 'therapist-1' } as any);
      vi.mocked(prisma.tenantSettings.findUnique).mockResolvedValue({
        workingHoursStart: '09:00',
        workingHoursEnd: '17:00',
        workingDays: [],
      } as any);
      vi.mocked(prisma.appointment.findMany).mockResolvedValue([]);

      const result = await therapistService.getUtilisation(tenantId, 'therapist-1', '2024-06-03', '2024-06-03');

      expect(result.utilisation).toBe(0);
    });

    it('should use default working hours when no settings', async () => {
      vi.mocked(prisma.therapist.findFirst).mockResolvedValue({ id: 'therapist-1' } as any);
      vi.mocked(prisma.tenantSettings.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.appointment.findMany).mockResolvedValue([]);

      const result = await therapistService.getUtilisation(tenantId, 'therapist-1', '2024-06-03', '2024-06-03');

      expect(result.utilisation).toBe(0);
      expect(result.totalAvailableMinutes).toBe(540);
    });
  });
});
