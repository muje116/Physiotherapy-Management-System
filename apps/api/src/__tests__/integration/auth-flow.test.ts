import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import supertest from 'supertest';
import jwt from 'jsonwebtoken';
import { buildApp } from '../../index';

vi.mock('@physiocore/db', () => {
  const mockPrisma: any = {
    tenant: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), upsert: vi.fn() },
    user: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), upsert: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    refreshToken: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
    tenantSettings: { findUnique: vi.fn(), upsert: vi.fn() },
    auditLog: { create: vi.fn() },
    notificationTemplate: { findFirst: vi.fn() },
    notificationChannel: { findFirst: vi.fn() },
    appointment: { findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn() },
    patient: { findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn() },
    therapist: { findFirst: vi.fn() },
    scheduleBlock: { findMany: vi.fn() },
    soapNote: { findMany: vi.fn() },
    invoice: { findMany: vi.fn() },
    exercisePlan: { findMany: vi.fn() },
    outcomeMeasure: { findMany: vi.fn() },
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

import { prisma, Role } from '@physiocore/db';
import bcrypt from 'bcrypt';

describe('Auth Flow Integration', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  const testUserId = 'test-user-id';
  const testTenantId = 'test-tenant-id';

  const mockUser = {
    id: testUserId, tenantId: testTenantId, email: 'admin@test.com',
    passwordHash: 'hashed-password', firstName: 'Test', lastName: 'Admin',
    role: Role.SUPER_ADMIN, isActive: true, lastLoginAt: null,
    createdAt: new Date(), updatedAt: new Date(),
    tenant: { id: testTenantId, name: 'Test Clinic', slug: 'test-clinic', isActive: true },
  };

  const mockTenant = {
    id: testTenantId, name: 'Test Clinic', slug: 'test-clinic', isActive: true,
    practiceNumber: null, vatNumber: null, timezone: 'Africa/Johannesburg',
    currency: 'ZAR', logoUrl: null, createdAt: new Date(), updatedAt: new Date(),
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

  describe('POST /api/v1/auth/register-tenant', () => {
    it('creates tenant + super_admin, returns tokens', async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.tenant.create).mockResolvedValue({
        ...mockTenant, name: 'New Clinic', slug: 'new-clinic',
        users: [{ ...mockUser }],
      } as any);
      vi.mocked(prisma.refreshToken.create).mockResolvedValue({ id: 'rt-1' } as any);

      const res = await supertest(app.server)
        .post('/api/v1/auth/register-tenant')
        .send({
          name: 'New Clinic', slug: 'new-clinic',
          adminEmail: 'admin@test.com', adminPassword: 'Password123!',
          adminFirstName: 'Test', adminLastName: 'Admin',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      expect(res.body.data.user.email).toBe('admin@test.com');
      expect(res.body.data.user.role).toBe(Role.SUPER_ADMIN);
    });

    it('returns 409 when tenant slug exists', async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValue({ id: 'existing' } as any);

      const res = await supertest(app.server)
        .post('/api/v1/auth/register-tenant')
        .send({
          name: 'Dup', slug: 'existing', adminEmail: 'a@b.com',
          adminPassword: 'Pass123!', adminFirstName: 'A', adminLastName: 'B',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('returns 409 when email already registered', async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'existing' } as any);

      const res = await supertest(app.server)
        .post('/api/v1/auth/register-tenant')
        .send({
          name: 'New', slug: 'new', adminEmail: 'used@test.com',
          adminPassword: 'Pass123!', adminFirstName: 'A', adminLastName: 'B',
        });

      expect(res.status).toBe(409);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('returns tokens + user with valid credentials', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser as any);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      vi.mocked(prisma.user.update).mockResolvedValue(mockUser as any);
      vi.mocked(prisma.refreshToken.create).mockResolvedValue({ id: 'rt-1' } as any);

      const res = await supertest(app.server)
        .post('/api/v1/auth/login')
        .send({ email: 'admin@test.com', password: 'Password123!', tenantSlug: 'test-clinic' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.user.email).toBe('admin@test.com');
    });

    it('returns 401 without auth token on refresh', async () => {
      const res = await supertest(app.server).post('/api/v1/auth/refresh').send({ refreshToken: '550e8400-e29b-41d4-a716-446655440000' });
      if (res.status !== 401) console.error('DIAG refresh no auth:', JSON.stringify(res.body));
      expect(res.status).toBe(401);
    });

    it('returns 401 with wrong password', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser as any);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      const res = await supertest(app.server)
        .post('/api/v1/auth/login')
        .send({ email: 'admin@test.com', password: 'wrong', tenantSlug: 'test-clinic' });

      expect(res.status).toBe(401);
    });

    it('returns 401 with non-existent tenant slug', async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValue(null);

      const res = await supertest(app.server)
        .post('/api/v1/auth/login')
        .send({ email: 'admin@test.com', password: 'pass', tenantSlug: 'nonexistent' });

      expect(res.status).toBe(401);
    });

    it('returns 401 for inactive user', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue({ ...mockUser, isActive: false } as any);

      const res = await supertest(app.server)
        .post('/api/v1/auth/login')
        .send({ email: 'admin@test.com', password: 'pass', tenantSlug: 'test-clinic' });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('returns new tokens with valid refresh token', async () => {
      vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue({
        id: 'rt-1', token: 'any-hashed-token', userId: testUserId,
        expiresAt: new Date(Date.now() + 86400000), createdAt: new Date(),
        user: { id: testUserId, tenantId: testTenantId, role: Role.SUPER_ADMIN, isActive: true },
      } as any);
      vi.mocked(prisma.refreshToken.delete).mockResolvedValue({} as any);
      vi.mocked(prisma.refreshToken.create).mockResolvedValue({ id: 'rt-2' } as any);

      const res = await supertest(app.server)
        .post('/api/v1/auth/refresh')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ refreshToken: '550e8400-e29b-41d4-a716-446655440000' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
    });

    it('returns 401 with expired refresh token', async () => {
      vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue({
        id: 'rt-1', token: 'hashed', userId: testUserId,
        expiresAt: new Date(Date.now() - 86400000), createdAt: new Date(),
        user: { id: testUserId, isActive: true },
      } as any);

      const res = await supertest(app.server)
        .post('/api/v1/auth/refresh')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ refreshToken: '550e8400-e29b-41d4-a716-446655440000' });

      expect(res.status).toBe(401);
    });

    it('returns 401 when refresh token not found', async () => {
      vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue(null);

      const res = await supertest(app.server)
        .post('/api/v1/auth/refresh')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ refreshToken: '550e8400-e29b-41d4-a716-446655440000' });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('deletes refresh token', async () => {
      vi.mocked(prisma.refreshToken.deleteMany).mockResolvedValue({ count: 1 } as any);

      const res = await supertest(app.server)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ refreshToken: '550e8400-e29b-41d4-a716-446655440000' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledOnce();
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('returns user when authenticated', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);

      const res = await supertest(app.server)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe('admin@test.com');
      expect(res.body.data.role).toBe(Role.SUPER_ADMIN);
      expect(res.body.data.permissions).toBeDefined();
      expect(res.body.data.permissions.length).toBeGreaterThan(0);
      expect(res.body.data.permissions).toContain('patient:read');
    });

    it('returns 401 when not authenticated', async () => {
      const res = await supertest(app.server).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
    });

    it('returns 401 with invalid token', async () => {
      const res = await supertest(app.server)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid-token');
      expect(res.status).toBe(401);
    });

    it('returns 401 when user not found in DB', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      const token = jwt.sign(
        { sub: 'nonexistent', tenantId: testTenantId, role: Role.SUPER_ADMIN },
        process.env.JWT_ACCESS_SECRET || 'test-access-secret',
        { expiresIn: '15m' },
      );

      const res = await supertest(app.server)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(401);
    });
  });
});
