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
    portalService: {} as any,
    $executeRaw: vi.fn(),
    $transaction: vi.fn((cb: (p: any) => any) => cb(mockPrisma)),
  };
  return { prisma: mockPrisma, Role: { SUPER_ADMIN: 'SUPER_ADMIN', ADMIN: 'ADMIN', FRONT_DESK: 'FRONT_DESK', THERAPIST: 'THERAPIST', BILLING: 'BILLING', PATIENT: 'PATIENT' }, AppointmentStatus: { SCHEDULED: 'SCHEDULED', CONFIRMED: 'CONFIRMED', CANCELLED: 'CANCELLED', NO_SHOW: 'NO_SHOW', COMPLETED: 'COMPLETED' }, AppointmentType: { INITIAL_ASSESSMENT: 'INITIAL_ASSESSMENT', FOLLOW_UP: 'FOLLOW_UP', MANUAL_THERAPY: 'MANUAL_THERAPY', EXERCISE_PRESCRIPTION: 'EXERCISE_PRESCRIPTION', TELEHEALTH: 'TELEHEALTH', GROUP_SESSION: 'GROUP_SESSION' }, Prisma: { PrismaClientKnownRequestError: class extends Error { constructor(public code: string) { super(); this.name = 'PrismaClientKnownRequestError'; } } } };
});

vi.mock('../utils/helpers', () => ({
  generatePatientCode: vi.fn(() => Promise.resolve('P-00001')),
  sanitizeInput: vi.fn((s: string) => s),
  calculateVat: vi.fn((a: number) => ({ subtotal: a, vatAmount: a * 0.15, total: a * 1.15 })),
}));

vi.mock('bcrypt', () => ({
  default: { hash: vi.fn(() => 'hashed-password'), compare: vi.fn() },
  hash: vi.fn(() => 'hashed-password'),
  compare: vi.fn(),
}));

vi.mock('@fastify/rate-limit', () => ({
  default: vi.fn().mockImplementation(async (_app: any) => {}),
}));

import { prisma, Role } from '@physiocore/db';

describe('RBAC Flow Integration', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  const testUserId = 'test-user-id';
  const testTenantId = 'test-tenant-id';

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
    therapists: [] as any[],
  };

  function makeToken(role: Role): string {
    return jwt.sign(
      { sub: testUserId, tenantId: testTenantId, role },
      process.env.JWT_ACCESS_SECRET || 'test-access-secret',
      { expiresIn: '15m' },
    );
  }

  function makeUser(role: Role) {
    return {
      id: testUserId, tenantId: testTenantId, email: `user@${role.toLowerCase()}.com`,
      passwordHash: 'hashed', firstName: role, lastName: 'User',
      role, isActive: true, lastLoginAt: null,
      createdAt: new Date(), updatedAt: new Date(),
      tenant: { id: testTenantId, name: 'Test Clinic', slug: 'test-clinic', isActive: true },
    };
  }

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
    vi.mocked(prisma.$executeRaw).mockResolvedValue(0 as any);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);
    vi.mocked(prisma.patient.findMany).mockResolvedValue([mockPatient] as any);
    vi.mocked(prisma.patient.findFirst).mockResolvedValue(mockPatient as any);
    vi.mocked(prisma.patient.count).mockResolvedValue(1);
    vi.mocked(prisma.patient.create).mockResolvedValue(mockPatient as any);
    vi.mocked(prisma.patient.update).mockResolvedValue(mockPatient as any);
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([]);
    vi.mocked(prisma.appointment.count).mockResolvedValue(0);
  });

  function setUser(role: Role) {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(makeUser(role) as any);
  }

  function expectSuccess(res: any) {
    expect(res.status).toBeLessThan(400);
    expect(res.body.success).toBe(true);
  }

  function expectForbidden(res: any) {
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  }

  function expectUnauthorized(res: any) {
    expect(res.status).toBe(401);
  }

  const endpoints: { method: string; path: string; body?: any; rolePermission: Record<Role, 'allow' | 'deny'> }[] = [
    { method: 'GET', path: '/api/v1/patients', rolePermission: { SUPER_ADMIN: 'allow', ADMIN: 'allow', FRONT_DESK: 'allow', THERAPIST: 'allow', BILLING: 'allow', PATIENT: 'deny' } },
    { method: 'POST', path: '/api/v1/patients', body: { firstName: 'John', lastName: 'Doe', dateOfBirth: '1990-01-01', gender: 'Male', phone: '0712345678' }, rolePermission: { SUPER_ADMIN: 'allow', ADMIN: 'allow', FRONT_DESK: 'allow', THERAPIST: 'allow', BILLING: 'deny', PATIENT: 'deny' } },
    { method: 'GET', path: '/api/v1/patients/patient-1', rolePermission: { SUPER_ADMIN: 'allow', ADMIN: 'allow', FRONT_DESK: 'allow', THERAPIST: 'allow', BILLING: 'allow', PATIENT: 'deny' } },
    { method: 'PATCH', path: '/api/v1/patients/patient-1', body: { firstName: 'Jane' }, rolePermission: { SUPER_ADMIN: 'allow', ADMIN: 'allow', FRONT_DESK: 'allow', THERAPIST: 'allow', BILLING: 'deny', PATIENT: 'deny' } },
    { method: 'DELETE', path: '/api/v1/patients/patient-1', rolePermission: { SUPER_ADMIN: 'allow', ADMIN: 'allow', FRONT_DESK: 'allow', THERAPIST: 'deny', BILLING: 'deny', PATIENT: 'deny' } },
    { method: 'GET', path: '/api/v1/appointments', rolePermission: { SUPER_ADMIN: 'allow', ADMIN: 'allow', FRONT_DESK: 'allow', THERAPIST: 'allow', BILLING: 'allow', PATIENT: 'deny' } },
    { method: 'POST', path: '/api/v1/appointments', body: { patientId: 'p1', therapistId: 't1', startAt: '2024-07-01T09:00:00Z', endAt: '2024-07-01T09:45:00Z', type: 'INITIAL_ASSESSMENT' }, rolePermission: { SUPER_ADMIN: 'allow', ADMIN: 'allow', FRONT_DESK: 'allow', THERAPIST: 'allow', BILLING: 'deny', PATIENT: 'deny' } },
    { method: 'GET', path: '/api/v1/patients/patient-1/soap-notes', rolePermission: { SUPER_ADMIN: 'allow', ADMIN: 'allow', FRONT_DESK: 'deny', THERAPIST: 'allow', BILLING: 'deny', PATIENT: 'deny' } },
    { method: 'GET', path: '/api/v1/patients/patient-1/invoices', rolePermission: { SUPER_ADMIN: 'allow', ADMIN: 'allow', FRONT_DESK: 'deny', THERAPIST: 'deny', BILLING: 'allow', PATIENT: 'deny' } },
    { method: 'GET', path: '/api/v1/portal/me', rolePermission: { SUPER_ADMIN: 'deny', ADMIN: 'deny', FRONT_DESK: 'deny', THERAPIST: 'deny', BILLING: 'deny', PATIENT: 'allow' } },
  ];

  const roles: Role[] = [Role.SUPER_ADMIN, Role.ADMIN, Role.FRONT_DESK, Role.THERAPIST, Role.BILLING, Role.PATIENT];

  describe.each(roles)('Role: %s', (role) => {
    it.each(endpoints)('$method $path', async ({ method, path, body, rolePermission }) => {
      setUser(role);
      const token = makeToken(role);

      if (role === Role.PATIENT && !path.startsWith('/api/v1/portal')) {
        const res = await supertest(app.server)
          [method.toLowerCase() as 'get' | 'post' | 'patch' | 'delete'](path)
          .set('Authorization', `Bearer ${token}`)
          .send(body);
        expectForbidden(res);
        return;
      }

      const expected = rolePermission[role];
      const res = await supertest(app.server)
        [method.toLowerCase() as 'get' | 'post' | 'patch' | 'delete'](path)
        .set('Authorization', `Bearer ${token}`)
        .send(body || undefined);

      if (expected === 'allow') {
        if (method === 'POST' && (path === '/api/v1/patients' || path === '/api/v1/appointments')) {
          expect(res.status).toBe(201);
        } else {
          expectSuccess(res);
        }
      } else {
        expectForbidden(res);
      }
    });
  });

  describe('Unauthenticated requests', () => {
    it.each([
      ['GET', '/api/v1/patients'],
      ['POST', '/api/v1/patients'],
      ['GET', '/api/v1/patients/patient-1'],
      ['PATCH', '/api/v1/patients/patient-1'],
      ['DELETE', '/api/v1/patients/patient-1'],
      ['GET', '/api/v1/appointments'],
      ['GET', '/api/v1/appointments/available-slots'],
      ['GET', '/api/v1/auth/me'],
    ])('%s %s returns 401', async (method, path) => {
      const res = await supertest(app.server)
        [method.toLowerCase() as 'get' | 'post' | 'patch' | 'delete'](path)
        .send();
      expectUnauthorized(res);
    });
  });
});
