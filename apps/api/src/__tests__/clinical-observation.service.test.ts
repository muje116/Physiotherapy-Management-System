import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@physiocore/db', () => ({
  prisma: {
    patient: { findFirst: vi.fn() },
    user: { findFirst: vi.fn() },
    appointment: { findFirst: vi.fn() },
    clinicalObservation: { findMany: vi.fn(), create: vi.fn() },
  },
}));

import { prisma } from '@physiocore/db';
import * as clinicalObservationService from '../services/clinical-observation.service';

describe('clinical-observation.service', () => {
  const tenantId = 'tenant-1';
  const patientId = 'patient-1';
  const userId = 'user-1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates an observation only for a patient and appointment in the same tenant', async () => {
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: patientId } as any);
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: userId } as any);
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue({ id: 'appointment-1' } as any);
    vi.mocked(prisma.clinicalObservation.create).mockResolvedValue({ id: 'observation-1' } as any);

    const result = await clinicalObservationService.create(tenantId, patientId, userId, {
      appointmentId: 'appointment-1',
      systolicBp: 120,
      diastolicBp: 80,
      pulse: 72,
      painScore: 3,
    });

    expect(result.id).toBe('observation-1');
    expect(prisma.appointment.findFirst).toHaveBeenCalledWith({
      where: { id: 'appointment-1', tenantId, patientId },
      select: { id: true },
    });
    expect(prisma.clinicalObservation.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ tenantId, patientId, recordedByUserId: userId, systolicBp: 120, diastolicBp: 80 }),
    }));
  });

  it('rejects an appointment belonging to another patient', async () => {
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: patientId } as any);
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: userId } as any);
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(null);

    await expect(clinicalObservationService.create(tenantId, patientId, userId, {
      appointmentId: 'appointment-1',
      pulse: 72,
    })).rejects.toThrow('Appointment not found for this patient');
    expect(prisma.clinicalObservation.create).not.toHaveBeenCalled();
  });
});
