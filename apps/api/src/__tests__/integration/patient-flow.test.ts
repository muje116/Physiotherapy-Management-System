import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import supertest from 'supertest';
import jwt from 'jsonwebtoken';
import { buildApp } from '../../index';

vi.mock('@physiocore/db', () => {
  const mockPrisma: any = {
    patient: { findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn() },
    appointment: { findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn() },
    soapNote: { findMany: vi.fn() },
    invoice: { findMany: vi.fn() },
    exercisePlan: { findMany: vi.fn() },
    outcomeMeasure: { findMany: vi.fn() },
    therapist: { findFirst: vi.fn() },
    tenantSettings: { findUnique: vi.fn(), upsert: vi.fn() },
    scheduleBlock: { findMany: vi.fn() },
    tenant: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), upsert: vi.fn() },
    user: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), upsert: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    refreshToken: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
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

vi.mock('@/lib/helpers', () => ({
  generatePatientCode: vi.fn(() => Promise.resolve('P-00001')),
  sanitizeInput: vi.fn((s: string) => s),
}));

vi.mock('../utils/helpers', () => ({
  generatePatientCode: vi.fn(() => Promise.resolve('P-00001')),
  sanitizeInput: vi.fn((s: string) => s),
  calculateVat: vi.fn((a: number) => ({ subtotal: a, vatAmount: a * 0.15, total: a * 1.15 })),
}));

import { prisma, Role } from '@physiocore/db';

describe('Patient Flow Integration', () => {
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

  const mockPatient = {
    id: 'patient-1', tenantId: testTenantId, patientCode: 'P-00001',
    firstName: 'John', lastName: 'Doe', dateOfBirth: new Date('1990-01-01'),
    gender: 'Male', phone: '0712345678', email: 'john@example.com',
    address: '123 Main St', isActive: true, createdAt: new Date(), updatedAt: new Date(),
    therapists: [] as any[], _count: { appointments: 0, invoices: 0, soapNotes: 0, exercisePlans: 0, outcomeMeasures: 0 },
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

  describe('GET /api/v1/patients', () => {
    it('returns paginated list of patients', async () => {
      vi.mocked(prisma.patient.findMany).mockResolvedValue([mockPatient] as any);
      vi.mocked(prisma.patient.count).mockResolvedValue(1);

      const res = await supertest(app.server)
        .get('/api/v1/patients?page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.total).toBe(1);
    });

    it('filters by search query', async () => {
      vi.mocked(prisma.patient.findMany).mockResolvedValue([] as any);
      vi.mocked(prisma.patient.count).mockResolvedValue(0);

      const res = await supertest(app.server)
        .get('/api/v1/patients?search=John')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(prisma.patient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ OR: expect.any(Array) }),
        }),
      );
    });

    it('returns empty list when no patients match', async () => {
      vi.mocked(prisma.patient.findMany).mockResolvedValue([]);
      vi.mocked(prisma.patient.count).mockResolvedValue(0);

      const res = await supertest(app.server)
        .get('/api/v1/patients')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
      expect(res.body.meta.total).toBe(0);
    });
  });

  describe('POST /api/v1/patients', () => {
    it('creates a new patient', async () => {
      vi.mocked(prisma.patient.create).mockResolvedValue(mockPatient as any);

      const res = await supertest(app.server)
        .post('/api/v1/patients')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          firstName: 'John', lastName: 'Doe', dateOfBirth: '1990-01-01',
          gender: 'Male', phone: '0712345678', email: 'john@example.com',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('patient-1');
      expect(res.body.data.patientCode).toBe('P-00001');
    });

    it('returns 400 for missing required fields', async () => {
      const res = await supertest(app.server)
        .post('/api/v1/patients')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ firstName: 'John' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/patients/:id', () => {
    it('returns patient by id', async () => {
      vi.mocked(prisma.patient.findFirst).mockResolvedValue(mockPatient as any);

      const res = await supertest(app.server)
        .get('/api/v1/patients/patient-1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('patient-1');
      expect(res.body.data.firstName).toBe('John');
    });

    it('returns 404 for non-existent patient', async () => {
      vi.mocked(prisma.patient.findFirst).mockResolvedValue(null);

      const res = await supertest(app.server)
        .get('/api/v1/patients/patient-999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/v1/patients/:id', () => {
    it('updates an existing patient', async () => {
      vi.mocked(prisma.patient.findFirst).mockResolvedValue(mockPatient as any);
      vi.mocked(prisma.patient.update).mockResolvedValue({ ...mockPatient, firstName: 'Jane' } as any);

      const res = await supertest(app.server)
        .patch('/api/v1/patients/patient-1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ firstName: 'Jane' });

      expect(res.status).toBe(200);
      expect(res.body.data.firstName).toBe('Jane');
    });

    it('returns 404 for non-existent patient', async () => {
      vi.mocked(prisma.patient.findFirst).mockResolvedValue(null);

      const res = await supertest(app.server)
        .patch('/api/v1/patients/patient-999')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ firstName: 'Jane' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/patients/:id', () => {
    it('soft deletes a patient', async () => {
      vi.mocked(prisma.patient.findFirst).mockResolvedValue(mockPatient as any);
      vi.mocked(prisma.patient.update).mockResolvedValue({ ...mockPatient, isActive: false } as any);

      const res = await supertest(app.server)
        .delete('/api/v1/patients/patient-1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(prisma.patient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'patient-1' },
          data: expect.objectContaining({ isActive: false }),
        }),
      );
    });

    it('returns 404 for non-existent patient', async () => {
      vi.mocked(prisma.patient.findFirst).mockResolvedValue(null);

      const res = await supertest(app.server)
        .delete('/api/v1/patients/patient-999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/v1/patients/:id/appointments', () => {
    it('returns appointments sub-resource', async () => {
      vi.mocked(prisma.patient.findFirst).mockResolvedValue(mockPatient as any);
      vi.mocked(prisma.appointment.findMany).mockResolvedValue([
        { id: 'apt-1', patientId: 'patient-1', tenantId: testTenantId, startAt: new Date(), endAt: new Date(), status: 'SCHEDULED' },
      ] as any);

      const res = await supertest(app.server)
        .get('/api/v1/patients/patient-1/appointments')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });
  });

  describe('GET /api/v1/patients/:id/timeline', () => {
    it('returns merged timeline sorted by date desc', async () => {
      vi.mocked(prisma.patient.findFirst).mockResolvedValue(mockPatient as any);
      vi.mocked(prisma.appointment.findMany).mockResolvedValue([
        { id: 'apt-1', startAt: new Date('2024-06-01') },
      ] as any);
      vi.mocked(prisma.soapNote.findMany).mockResolvedValue([
        { id: 'note-1', createdAt: new Date('2024-06-02') },
      ] as any);
      vi.mocked(prisma.invoice.findMany).mockResolvedValue([] as any);
      vi.mocked(prisma.exercisePlan.findMany).mockResolvedValue([] as any);

      const res = await supertest(app.server)
        .get('/api/v1/patients/patient-1/timeline')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].type).toBe('soap_note');
      expect(res.body.data[1].type).toBe('appointment');
    });
  });
});
