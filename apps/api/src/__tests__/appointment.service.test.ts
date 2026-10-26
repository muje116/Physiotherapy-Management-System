import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@physiocore/db', () => ({
  prisma: {
    appointment: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    therapist: {
      findFirst: vi.fn(),
    },
    patient: {
      findFirst: vi.fn(),
    },
    tenantSettings: {
      findUnique: vi.fn(),
    },
    scheduleBlock: {
      findMany: vi.fn(),
    },
  },
  AppointmentStatus: {
    SCHEDULED: 'SCHEDULED',
    CONFIRMED: 'CONFIRMED',
    CHECKED_IN: 'CHECKED_IN',
    IN_SESSION: 'IN_SESSION',
    CANCELLED: 'CANCELLED',
    NO_SHOW: 'NO_SHOW',
    COMPLETED: 'COMPLETED',
  },
  AppointmentType: {
    INITIAL_ASSESSMENT: 'INITIAL_ASSESSMENT',
    FOLLOW_UP: 'FOLLOW_UP',
    MANUAL_THERAPY: 'MANUAL_THERAPY',
    EXERCISE_PRESCRIPTION: 'EXERCISE_PRESCRIPTION',
    TELEHEALTH: 'TELEHEALTH',
    GROUP_SESSION: 'GROUP_SESSION',
  },
}));

import { prisma, AppointmentStatus, AppointmentType } from '@physiocore/db';
import * as appointmentService from '../services/appointment.service';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors';

describe('appointment.service', () => {
  const tenantId = 'tenant-1';
  const mockAppointment = {
    id: 'apt-1',
    tenantId,
    patientId: 'patient-1',
    therapistId: 'therapist-1',
    startAt: new Date('2024-06-01T09:00:00Z'),
    endAt: new Date('2024-06-01T09:45:00Z'),
    status: AppointmentStatus.SCHEDULED,
    type: AppointmentType.INITIAL_ASSESSMENT,
    isTelehealth: false,
    notes: null,
    cancelledAt: null,
    cancelledReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'patient-1' } as any);
    vi.mocked(prisma.therapist.findFirst).mockResolvedValue({ id: 'therapist-1' } as any);
  });

  describe('list', () => {
    it('should return paginated appointments with filters', async () => {
      vi.mocked(prisma.appointment.findMany).mockResolvedValue([
        { ...mockAppointment, patient: { firstName: 'John' }, therapist: { user: { firstName: 'Dr' } } },
      ] as any);
      vi.mocked(prisma.appointment.count).mockResolvedValue(1);

      const result = await appointmentService.list(tenantId, {
        page: 1,
        limit: 10,
        therapistId: 'therapist-1',
        status: AppointmentStatus.SCHEDULED,
        startDate: '2024-06-01',
        endDate: '2024-06-30',
      });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(prisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId,
            therapistId: 'therapist-1',
            status: AppointmentStatus.SCHEDULED,
            startAt: expect.objectContaining({ gte: expect.any(Date), lte: expect.any(Date) }),
          }),
        }),
      );
    });

    it('should return empty list when no appointments match', async () => {
      vi.mocked(prisma.appointment.findMany).mockResolvedValue([]);
      vi.mocked(prisma.appointment.count).mockResolvedValue(0);

      const result = await appointmentService.list(tenantId, { page: 1, limit: 10 });

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('create', () => {
    const validData = {
      patientId: 'patient-1',
      therapistId: 'therapist-1',
      startAt: '2024-06-01T09:00:00Z',
      endAt: '2024-06-01T09:45:00Z',
      type: 'INITIAL_ASSESSMENT',
    };

    it('should create an appointment when no overlap exists', async () => {
      vi.mocked(prisma.appointment.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.appointment.create).mockResolvedValue({
        ...mockAppointment,
        patient: { id: 'patient-1', firstName: 'John', lastName: 'Doe', patientCode: 'P-00001' },
        therapist: { user: { firstName: 'Dr', lastName: 'Smith' } },
      } as any);

      const result = await appointmentService.create(tenantId, validData);

      expect(result.id).toBe('apt-1');
      expect(prisma.appointment.create).toHaveBeenCalled();
    });

    it('should throw ConflictError when overlapping appointment exists', async () => {
      vi.mocked(prisma.appointment.findFirst).mockResolvedValue(mockAppointment as any);

      await expect(appointmentService.create(tenantId, validData)).rejects.toThrow(
        'Therapist has an overlapping appointment',
      );
    });

    it('should ignore cancelled and no-show appointments in overlap check', async () => {
      vi.mocked(prisma.appointment.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.appointment.create).mockResolvedValue(mockAppointment as any);

      await appointmentService.create(tenantId, validData);

      expect(prisma.appointment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW] },
          }),
        }),
      );
    });

    it('should set isTelehealth to true when provided', async () => {
      vi.mocked(prisma.appointment.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.appointment.create).mockResolvedValue(mockAppointment as any);

      await appointmentService.create(tenantId, { ...validData, isTelehealth: true });

      expect(prisma.appointment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isTelehealth: true }),
        }),
      );
    });
  });

  describe('getById', () => {
    it('should return appointment by id within tenant', async () => {
      vi.mocked(prisma.appointment.findFirst).mockResolvedValue({
        ...mockAppointment,
        patient: {},
        therapist: {},
        soapNote: null,
        invoice: null,
      } as any);

      const result = await appointmentService.getById(tenantId, 'apt-1');
      expect(result.id).toBe('apt-1');
    });

    it('should throw NotFoundError for non-existent appointment', async () => {
      vi.mocked(prisma.appointment.findFirst).mockResolvedValue(null);

      await expect(appointmentService.getById(tenantId, 'apt-999')).rejects.toThrow('Appointment not found');
    });
  });

  describe('update', () => {
    it('should update appointment fields', async () => {
      vi.mocked(prisma.appointment.findFirst).mockResolvedValue(mockAppointment as any);
      vi.mocked(prisma.appointment.update).mockResolvedValue({ ...mockAppointment, notes: 'Updated' } as any);

      const result = await appointmentService.update(tenantId, 'apt-1', { notes: 'Updated' });

      expect((result as any).notes).toBe('Updated');
    });

    it('should set cancelledAt when status is CANCELLED', async () => {
      vi.mocked(prisma.appointment.findFirst).mockResolvedValue(mockAppointment as any);
      vi.mocked(prisma.appointment.update).mockResolvedValue({ ...mockAppointment, status: AppointmentStatus.CANCELLED } as any);

      await appointmentService.update(tenantId, 'apt-1', { status: AppointmentStatus.CANCELLED });

      expect(prisma.appointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ cancelledAt: expect.any(Date) }),
        }),
      );
    });

    it('should reject an invalid edited time range', async () => {
      vi.mocked(prisma.appointment.findFirst).mockResolvedValue(mockAppointment as any);

      await expect(appointmentService.update(tenantId, 'apt-1', {
        startAt: '2024-06-01T10:00:00Z',
        endAt: '2024-06-01T09:00:00Z',
      })).rejects.toThrow(ValidationError);
      expect(prisma.appointment.update).not.toHaveBeenCalled();
    });

    it('should reject an edited time that overlaps another appointment', async () => {
      vi.mocked(prisma.appointment.findFirst)
        .mockResolvedValueOnce(mockAppointment as any)
        .mockResolvedValueOnce({ id: 'apt-2' } as any);

      await expect(appointmentService.update(tenantId, 'apt-1', {
        startAt: '2024-06-01T09:15:00Z',
        endAt: '2024-06-01T10:00:00Z',
      })).rejects.toThrow('Therapist has an overlapping appointment');
      expect(prisma.appointment.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundError for non-existent', async () => {
      vi.mocked(prisma.appointment.findFirst).mockResolvedValue(null);

      await expect(appointmentService.update(tenantId, 'apt-999', { notes: 'test' })).rejects.toThrow('Appointment not found');
    });
  });

  describe('cancel', () => {
    it('should cancel appointment with reason', async () => {
      vi.mocked(prisma.appointment.findFirst).mockResolvedValue(mockAppointment as any);
      vi.mocked(prisma.appointment.update).mockResolvedValue({ ...mockAppointment, status: AppointmentStatus.CANCELLED } as any);

      const result = await appointmentService.cancel(tenantId, 'apt-1', 'Patient cancelled');

      expect(prisma.appointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: AppointmentStatus.CANCELLED,
            cancelledAt: expect.any(Date),
            cancelledReason: 'Patient cancelled',
          }),
        }),
      );
    });

    it('should throw NotFoundError on non-existent', async () => {
      vi.mocked(prisma.appointment.findFirst).mockResolvedValue(null);

      await expect(appointmentService.cancel(tenantId, 'apt-999')).rejects.toThrow('Appointment not found');
    });
  });

  describe('confirm', () => {
    it('should confirm appointment', async () => {
      vi.mocked(prisma.appointment.findFirst).mockResolvedValue(mockAppointment as any);
      vi.mocked(prisma.appointment.update).mockResolvedValue({ ...mockAppointment, status: AppointmentStatus.CONFIRMED } as any);

      const result = await appointmentService.confirm(tenantId, 'apt-1');

      expect(prisma.appointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: AppointmentStatus.CONFIRMED },
        }),
      );
    });

    it('should throw NotFoundError on non-existent', async () => {
      vi.mocked(prisma.appointment.findFirst).mockResolvedValue(null);

      await expect(appointmentService.confirm(tenantId, 'apt-999')).rejects.toThrow('Appointment not found');
    });
  });

  describe('checkIn', () => {
    it('records the arrival time, room, and priority', async () => {
      vi.mocked(prisma.appointment.findFirst).mockResolvedValue(mockAppointment as any);
      vi.mocked(prisma.appointment.update).mockResolvedValue({ ...mockAppointment, status: AppointmentStatus.CHECKED_IN } as any);

      await appointmentService.checkIn(tenantId, 'apt-1', { room: ' Room 2 ', queuePriority: 'URGENT' });

      expect(prisma.appointment.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          status: AppointmentStatus.CHECKED_IN,
          checkedInAt: expect.any(Date),
          room: 'Room 2',
          queuePriority: 'URGENT',
        }),
      }));
    });

    it('does not allow an active session to be checked in again', async () => {
      vi.mocked(prisma.appointment.findFirst).mockResolvedValue({ ...mockAppointment, status: AppointmentStatus.IN_SESSION } as any);

      await expect(appointmentService.checkIn(tenantId, 'apt-1', { queuePriority: 'STANDARD' }))
        .rejects.toThrow(ConflictError);
      expect(prisma.appointment.update).not.toHaveBeenCalled();
    });
  });

  describe('startSession', () => {
    it('only starts a checked-in appointment', async () => {
      vi.mocked(prisma.appointment.findFirst).mockResolvedValue({ ...mockAppointment, status: AppointmentStatus.CHECKED_IN } as any);
      vi.mocked(prisma.appointment.update).mockResolvedValue({ ...mockAppointment, status: AppointmentStatus.IN_SESSION } as any);

      await appointmentService.startSession(tenantId, 'apt-1');

      expect(prisma.appointment.update).toHaveBeenCalledWith(expect.objectContaining({
        data: { status: AppointmentStatus.IN_SESSION },
      }));
    });

    it('rejects starting before check-in', async () => {
      vi.mocked(prisma.appointment.findFirst).mockResolvedValue(mockAppointment as any);

      await expect(appointmentService.startSession(tenantId, 'apt-1')).rejects.toThrow(ConflictError);
    });
  });

  describe('getQueue', () => {
    it('returns active queue entries ordered by urgency and check-in time', async () => {
      vi.mocked(prisma.appointment.findMany).mockResolvedValue([]);

      await appointmentService.getQueue(tenantId, {});

      expect(prisma.appointment.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          tenantId,
          status: { in: [AppointmentStatus.CHECKED_IN, AppointmentStatus.IN_SESSION] },
        }),
        orderBy: [{ queuePriority: 'desc' }, { checkedInAt: 'asc' }],
      }));
    });
  });

  describe('markNoShow', () => {
    it('should mark appointment as no-show', async () => {
      vi.mocked(prisma.appointment.findFirst).mockResolvedValue(mockAppointment as any);
      vi.mocked(prisma.appointment.update).mockResolvedValue({ ...mockAppointment, status: AppointmentStatus.NO_SHOW } as any);

      const result = await appointmentService.markNoShow(tenantId, 'apt-1');

      expect(prisma.appointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: AppointmentStatus.NO_SHOW },
        }),
      );
    });
  });

  describe('getAvailableSlots', () => {
    it('should return available time slots for a therapist', async () => {
      vi.mocked(prisma.therapist.findFirst).mockResolvedValue({ id: 'therapist-1' } as any);
      vi.mocked(prisma.tenantSettings.findUnique).mockResolvedValue({
        workingHoursStart: '09:00',
        workingHoursEnd: '10:00',
        appointmentDuration: 30,
      } as any);
      vi.mocked(prisma.scheduleBlock.findMany).mockResolvedValue([]);
      vi.mocked(prisma.appointment.findMany).mockResolvedValue([]);

      const slots = await appointmentService.getAvailableSlots(tenantId, 'therapist-1', '2024-06-01');

      expect(slots.length).toBeGreaterThan(0);
      expect(slots[0]).toHaveProperty('start');
      expect(slots[0]).toHaveProperty('end');
    });

    it('should throw NotFoundError when therapist not found', async () => {
      vi.mocked(prisma.therapist.findFirst).mockResolvedValue(null);

      await expect(
        appointmentService.getAvailableSlots(tenantId, 'therapist-999', '2024-06-01'),
      ).rejects.toThrow('Therapist not found');
    });

    it('should use defaults when no tenant settings exist', async () => {
      vi.mocked(prisma.therapist.findFirst).mockResolvedValue({ id: 'therapist-1' } as any);
      vi.mocked(prisma.tenantSettings.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.scheduleBlock.findMany).mockResolvedValue([]);
      vi.mocked(prisma.appointment.findMany).mockResolvedValue([]);

      const slots = await appointmentService.getAvailableSlots(tenantId, 'therapist-1', '2024-06-01');

      expect(slots.length).toBeGreaterThan(0);
    });

    it('should query schedule blocks and appointments that overlap the day', async () => {
      vi.mocked(prisma.therapist.findFirst).mockResolvedValue({ id: 'therapist-1' } as any);
      vi.mocked(prisma.tenantSettings.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.scheduleBlock.findMany).mockResolvedValue([]);
      vi.mocked(prisma.appointment.findMany).mockResolvedValue([]);

      await appointmentService.getAvailableSlots(tenantId, 'therapist-1', '2024-06-01');

      expect(prisma.scheduleBlock.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          startAt: { lt: expect.any(Date) },
          endAt: { gt: expect.any(Date) },
        }),
      }));
      expect(prisma.appointment.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          startAt: { lt: expect.any(Date) },
          endAt: { gt: expect.any(Date) },
        }),
      }));
    });
  });
});
