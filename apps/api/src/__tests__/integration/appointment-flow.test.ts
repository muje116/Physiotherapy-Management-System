import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import supertest from 'supertest';
import jwt from 'jsonwebtoken';
import { buildApp } from '../../index';

vi.mock('@physiocore/db', () => {
  const mockPrisma: any = {
    appointment: { findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn() },
    patient: { findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn() },
    therapist: { findFirst: vi.fn() },
    tenantSettings: { findUnique: vi.fn(), upsert: vi.fn() },
    scheduleBlock: { findMany: vi.fn() },
    tenant: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), upsert: vi.fn() },
    user: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), upsert: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    refreshToken: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
    soapNote: { findMany: vi.fn() },
    invoice: { findMany: vi.fn() },
    exercisePlan: { findMany: vi.fn() },
    outcomeMeasure: { findMany: vi.fn() },
    auditLog: { create: vi.fn() },
    notificationTemplate: { findFirst: vi.fn() },
    notificationChannel: { findFirst: vi.fn() },
    $executeRaw: vi.fn(),
    $transaction: vi.fn((cb: (p: any) => any) => cb(mockPrisma)),
  };
  return { prisma: mockPrisma, Role: { SUPER_ADMIN: 'SUPER_ADMIN', ADMIN: 'ADMIN', FRONT_DESK: 'FRONT_DESK', THERAPIST: 'THERAPIST', BILLING: 'BILLING', PATIENT: 'PATIENT' }, AppointmentStatus: { SCHEDULED: 'SCHEDULED', CONFIRMED: 'CONFIRMED', CANCELLED: 'CANCELLED', NO_SHOW: 'NO_SHOW', COMPLETED: 'COMPLETED' }, AppointmentType: { INITIAL_ASSESSMENT: 'INITIAL_ASSESSMENT', FOLLOW_UP: 'FOLLOW_UP', MANUAL_THERAPY: 'MANUAL_THERAPY', EXERCISE_PRESCRIPTION: 'EXERCISE_PRESCRIPTION', TELEHEALTH: 'TELEHEALTH', GROUP_SESSION: 'GROUP_SESSION' }, Prisma: { PrismaClientKnownRequestError: class extends Error { constructor(public code: string) { super(); this.name = 'PrismaClientKnownRequestError'; } } } };
});

vi.mock('bcrypt', () => ({
  default: { hash: vi.fn(() => 'hashed-password'), compare: vi.fn() },
  hash: vi.fn(() => 'hashed-password'),
  compare: vi.fn(),
}));

vi.mock('@fastify/rate-limit', () => ({
  default: vi.fn().mockImplementation(async (_app: any) => {}),
}));

import { prisma, Role, AppointmentStatus, AppointmentType } from '@physiocore/db';

describe('Appointment Flow Integration', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  const testUserId = 'test-user-id';
  const testTenantId = 'test-tenant-id';

  const mockUser = {
    id: testUserId, tenantId: testTenantId, email: 'admin@test.com',
    passwordHash: 'hashed', firstName: 'Test', lastName: 'Admin',
    role: Role.SUPER_ADMIN, isActive: true, lastLoginAt: null,
    createdAt: new Date(), updatedAt: new Date(),
    tenant: { id: testTenantId, name: 'Test Clinic', slug: 'test-clinic', isActive: true },
  };

  const mockTenant = {
    id: testTenantId, name: 'Test Clinic', slug: 'test-clinic', isActive: true,
    practiceNumber: null, vatNumber: null, timezone: 'Africa/Johannesburg',
    currency: 'ZAR', logoUrl: null, createdAt: new Date(), updatedAt: new Date(),
  };

  const mockAppointment = {
    id: 'apt-1', tenantId: testTenantId, patientId: 'patient-1', therapistId: 'therapist-1',
    startAt: new Date('2024-06-01T09:00:00Z'), endAt: new Date('2024-06-01T09:45:00Z'),
    status: AppointmentStatus.SCHEDULED, type: AppointmentType.INITIAL_ASSESSMENT,
    isTelehealth: false, notes: null, cancelledAt: null, cancelledReason: null,
    createdAt: new Date(), updatedAt: new Date(),
    patient: { id: 'patient-1', firstName: 'John', lastName: 'Doe', patientCode: 'P-00001' },
    therapist: { user: { firstName: 'Dr', lastName: 'Smith' } },
  };

  const authToken = jwt.sign(
    { sub: testUserId, tenantId: testTenantId, role: Role.SUPER_ADMIN },
    process.env.JWT_ACCESS_SECRET || 'test-access-secret',
    { expiresIn: '15m' },
  );

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.tenant.findUnique).mockResolvedValue(mockTenant as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
    vi.mocked(prisma.$executeRaw).mockResolvedValue(0 as any);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);
  });

  describe('POST /api/v1/appointments', () => {
    it('creates an appointment when no overlap exists', async () => {
      vi.mocked(prisma.appointment.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.appointment.create).mockResolvedValue(mockAppointment as any);

      const res = await supertest(app.server)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          patientId: 'patient-1', therapistId: 'therapist-1',
          startAt: '2024-06-01T09:00:00Z', endAt: '2024-06-01T09:45:00Z',
          type: 'INITIAL_ASSESSMENT',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('apt-1');
    });

    it('returns 409 when overlapping appointment exists', async () => {
      vi.mocked(prisma.appointment.findFirst).mockResolvedValue(mockAppointment as any);

      const res = await supertest(app.server)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          patientId: 'patient-1', therapistId: 'therapist-1',
          startAt: '2024-06-01T09:00:00Z', endAt: '2024-06-01T09:45:00Z',
          type: 'INITIAL_ASSESSMENT',
        });

      expect(res.status).toBe(409);
    });

    it('ignores cancelled/no-show appointments in overlap check', async () => {
      vi.mocked(prisma.appointment.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.appointment.create).mockResolvedValue(mockAppointment as any);

      await supertest(app.server)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          patientId: 'patient-1', therapistId: 'therapist-1',
          startAt: '2024-06-01T09:00:00Z', endAt: '2024-06-01T09:45:00Z',
          type: 'INITIAL_ASSESSMENT',
        });

      expect(prisma.appointment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW] },
          }),
        }),
      );
    });
  });

  describe('GET /api/v1/appointments', () => {
    it('lists appointments with filters', async () => {
      vi.mocked(prisma.appointment.findMany).mockResolvedValue([mockAppointment] as any);
      vi.mocked(prisma.appointment.count).mockResolvedValue(1);

      const res = await supertest(app.server)
        .get('/api/v1/appointments?status=SCHEDULED&page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta.total).toBe(1);
    });

    it('returns empty list when no appointments match', async () => {
      vi.mocked(prisma.appointment.findMany).mockResolvedValue([]);
      vi.mocked(prisma.appointment.count).mockResolvedValue(0);

      const res = await supertest(app.server)
        .get('/api/v1/appointments')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });
  });

  describe('POST /api/v1/appointments/:id/confirm', () => {
    it('confirms an appointment', async () => {
      vi.mocked(prisma.appointment.findFirst).mockResolvedValue(mockAppointment as any);
      vi.mocked(prisma.appointment.update).mockResolvedValue({ ...mockAppointment, status: AppointmentStatus.CONFIRMED } as any);

      const res = await supertest(app.server)
        .post('/api/v1/appointments/apt-1/confirm')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(prisma.appointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: AppointmentStatus.CONFIRMED }),
        }),
      );
    });

    it('returns 404 for non-existent appointment', async () => {
      vi.mocked(prisma.appointment.findFirst).mockResolvedValue(null);

      const res = await supertest(app.server)
        .post('/api/v1/appointments/apt-999/confirm')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/v1/appointments/:id/no-show', () => {
    it('marks appointment as no-show', async () => {
      vi.mocked(prisma.appointment.findFirst).mockResolvedValue(mockAppointment as any);
      vi.mocked(prisma.appointment.update).mockResolvedValue({ ...mockAppointment, status: AppointmentStatus.NO_SHOW } as any);

      const res = await supertest(app.server)
        .post('/api/v1/appointments/apt-1/no-show')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(prisma.appointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: AppointmentStatus.NO_SHOW }),
        }),
      );
    });
  });

  describe('DELETE /api/v1/appointments/:id', () => {
    it('cancels an appointment', async () => {
      vi.mocked(prisma.appointment.findFirst).mockResolvedValue(mockAppointment as any);
      vi.mocked(prisma.appointment.update).mockResolvedValue({ ...mockAppointment, status: AppointmentStatus.CANCELLED } as any);

      const res = await supertest(app.server)
        .delete('/api/v1/appointments/apt-1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(prisma.appointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: AppointmentStatus.CANCELLED }),
        }),
      );
    });
  });

  describe('GET /api/v1/appointments/available-slots', () => {
    it('returns available time slots for a therapist', async () => {
      vi.mocked(prisma.therapist.findFirst).mockResolvedValue({ id: 'therapist-1' } as any);
      vi.mocked(prisma.tenantSettings.findUnique).mockResolvedValue({
        workingHoursStart: '09:00', workingHoursEnd: '17:00', appointmentDuration: 30,
      } as any);
      vi.mocked(prisma.scheduleBlock.findMany).mockResolvedValue([]);
      vi.mocked(prisma.appointment.findMany).mockResolvedValue([]);

      const res = await supertest(app.server)
        .get('/api/v1/appointments/available-slots?therapistId=therapist-1&date=2024-06-01')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      if (res.body.data.length > 0) {
        expect(res.body.data[0]).toHaveProperty('start');
        expect(res.body.data[0]).toHaveProperty('end');
      }
    });

    it('returns 404 for non-existent therapist', async () => {
      vi.mocked(prisma.therapist.findFirst).mockResolvedValue(null);

      const res = await supertest(app.server)
        .get('/api/v1/appointments/available-slots?therapistId=therapist-999&date=2024-06-01')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });

    it('uses defaults when no tenant settings exist', async () => {
      vi.mocked(prisma.therapist.findFirst).mockResolvedValue({ id: 'therapist-1' } as any);
      vi.mocked(prisma.tenantSettings.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.scheduleBlock.findMany).mockResolvedValue([]);
      vi.mocked(prisma.appointment.findMany).mockResolvedValue([]);

      const res = await supertest(app.server)
        .get('/api/v1/appointments/available-slots?therapistId=therapist-1&date=2024-06-01')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });
});
