import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

vi.mock('@physiocore/db', () => ({
  prisma: {
    tenant: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    refreshToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
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

vi.mock('uuid', () => ({
  v4: () => 'mock-uuid-token',
}));

vi.mock('crypto', () => ({
  default: {
    createHash: () => ({
      update: () => ({
        digest: () => 'hashed-token-value',
      }),
    }),
    randomUUID: vi.fn(() => 'mock-uuid-token'),
  },
  createHash: () => ({
    update: () => ({
      digest: () => 'hashed-token-value',
    }),
  }),
  randomUUID: vi.fn(() => 'mock-uuid-token'),
}));

vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn(() => 'hashed-password'),
    compare: vi.fn(),
  },
  hash: vi.fn(() => 'hashed-password'),
  compare: vi.fn(),
}));

vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn(() => 'mock-access-token'),
  },
  sign: vi.fn(() => 'mock-access-token'),
}));

vi.mock('../services/reset-token.store', () => ({
  resetTokenStore: {
    set: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
  },
}));

import { prisma, Role } from '@physiocore/db';
import * as authService from '../services/auth.service';

describe('auth.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('registerTenant', () => {
    const validInput = {
      name: 'Test Clinic',
      slug: 'test-clinic',
      adminEmail: 'admin@test.com',
      adminPassword: 'password123',
      adminFirstName: 'Test',
      adminLastName: 'Admin',
    };

    it('should register a new tenant and return tokens', async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.tenant.create).mockResolvedValue({
        id: 'tenant-1',
        name: 'Test Clinic',
        slug: 'test-clinic',
        practiceNumber: null,
        vatNumber: null,
        timezone: 'Africa/Johannesburg',
        currency: 'ZAR',
        logoUrl: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        users: [
          {
            id: 'user-1',
            tenantId: 'tenant-1',
            email: 'admin@test.com',
            passwordHash: 'hashed-password',
            firstName: 'Test',
            lastName: 'Admin',
            role: Role.SUPER_ADMIN,
            isActive: true,
            lastLoginAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      } as any);
      vi.mocked(prisma.refreshToken.create).mockResolvedValue({} as any);
      vi.mocked(bcrypt.hash).mockResolvedValue('hashed-password' as never);
      vi.mocked(jwt.sign).mockReturnValue('mock-access-token' as never);

      const result = await authService.registerTenant(validInput);

      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBe('mock-uuid-token');
      expect(result.user.email).toBe('admin@test.com');
      expect(result.user.role).toBe(Role.SUPER_ADMIN);
    });

    it('should throw ConflictError if tenant slug exists', async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValue({ id: 'existing' } as any);

      await expect(authService.registerTenant(validInput)).rejects.toThrow('Tenant slug already exists');
    });

    it('should throw ConflictError if email already registered', async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'existing-user' } as any);

      await expect(authService.registerTenant(validInput)).rejects.toThrow('Email already registered');
    });
  });

  describe('login', () => {
    it('should login successfully with valid credentials', async () => {
      const mockUser = {
        id: 'user-1',
        tenantId: 'tenant-1',
        email: 'admin@test.com',
        passwordHash: 'hashed-password',
        firstName: 'Test',
        lastName: 'Admin',
        role: Role.SUPER_ADMIN,
        isActive: true,
        tenant: { id: 'tenant-1', name: 'Test Clinic', slug: 'test-clinic' },
      };

      vi.mocked(prisma.tenant.findUnique).mockResolvedValue({ id: 'tenant-1' } as any);
      vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser as any);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      vi.mocked(prisma.user.update).mockResolvedValue(mockUser as any);
      vi.mocked(prisma.refreshToken.create).mockResolvedValue({} as any);
      vi.mocked(jwt.sign).mockReturnValue('mock-access-token' as never);

      const result = await authService.login('admin@test.com', 'password123', 'test-clinic');

      expect(result.accessToken).toBe('mock-access-token');
      expect(result.user.email).toBe('admin@test.com');
    });

    it('should throw UnauthorizedError for invalid password', async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValue({ id: 'tenant-1' } as any);
      vi.mocked(prisma.user.findFirst).mockResolvedValue({
        id: 'user-1',
        isActive: true,
        passwordHash: 'hashed-password',
        tenantId: 'tenant-1',
        email: 'admin@test.com',
      } as any);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      await expect(authService.login('admin@test.com', 'wrong-password', 'test-clinic')).rejects.toThrow('Invalid credentials');
    });

    it('should throw UnauthorizedError if tenantSlug does not exist', async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValue(null);

      await expect(authService.login('admin@test.com', 'password123', 'nonexistent')).rejects.toThrow('Invalid credentials');
    });

    it('should throw UnauthorizedError if user is inactive', async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValue({ id: 'tenant-1' } as any);
      vi.mocked(prisma.user.findFirst).mockResolvedValue({
        id: 'user-1',
        isActive: false,
        passwordHash: 'hashed-password',
        tenantId: 'tenant-1',
        email: 'admin@test.com',
      } as any);

      await expect(authService.login('admin@test.com', 'password123', 'test-clinic')).rejects.toThrow('Invalid credentials');
    });
  });

  describe('refreshToken', () => {
    it('should return new tokens for a valid refresh token', async () => {
      const mockStoredToken = {
        id: 'token-1',
        token: 'hashed-token-value',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        user: {
          id: 'user-1',
          tenantId: 'tenant-1',
          role: Role.SUPER_ADMIN,
          isActive: true,
        },
      };

      vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue(mockStoredToken as any);
      vi.mocked(prisma.refreshToken.delete).mockResolvedValue({} as any);
      vi.mocked(prisma.refreshToken.create).mockResolvedValue({} as any);
      vi.mocked(jwt.sign).mockReturnValue('new-access-token' as never);

      const result = await authService.refreshToken('valid-token');

      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBe('mock-uuid-token');
    });

    it('should throw UnauthorizedError for expired token', async () => {
      vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue({
        id: 'token-1',
        token: 'hashed-token-value',
        userId: 'user-1',
        expiresAt: new Date(Date.now() - 86400000),
        createdAt: new Date(),
        user: { id: 'user-1', isActive: true },
      } as any);

      await expect(authService.refreshToken('expired-token')).rejects.toThrow('Invalid or expired refresh token');
    });

    it('should throw UnauthorizedError for inactive user', async () => {
      vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue({
        id: 'token-1',
        token: 'hashed-token-value',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        user: { id: 'user-1', isActive: false },
      } as any);

      await expect(authService.refreshToken('valid-token')).rejects.toThrow('User account is inactive');
    });

    it('should throw UnauthorizedError when token not found', async () => {
      vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue(null);

      await expect(authService.refreshToken('invalid-token')).rejects.toThrow('Invalid or expired refresh token');
    });
  });

  describe('logout', () => {
    it('should delete the refresh token', async () => {
      vi.mocked(prisma.refreshToken.deleteMany).mockResolvedValue({ count: 1 } as any);

      await authService.logout('any-token');

      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { token: 'hashed-token-value' },
      });
    });
  });

  describe('getMe', () => {
    it('should return user with permissions array', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'admin@test.com',
        firstName: 'Test',
        lastName: 'Admin',
        role: Role.SUPER_ADMIN,
        tenantId: 'tenant-1',
        tenant: { id: 'tenant-1', name: 'Test Clinic', slug: 'test-clinic' },
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);

      const result = await authService.getMe('user-1');

      expect(result.id).toBe('user-1');
      expect(result.email).toBe('admin@test.com');
      expect(result.tenant).toBeDefined();
      expect(Array.isArray(result.permissions)).toBe(true);
      expect(result.permissions.length).toBeGreaterThan(0);
      expect(result.permissions).toContain('patient:read');
    });

    it('should throw NotFoundError when user not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(authService.getMe('nonexistent-user')).rejects.toThrow('User not found');
    });
  });

  describe('forgotPassword', () => {
    it('should generate reset token for valid email', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'user-1', email: 'user@test.com' } as any);
      const { resetTokenStore } = await import('../services/reset-token.store');

      await authService.forgotPassword('user@test.com');

      expect(resetTokenStore.set).toHaveBeenCalled();
    });

    it('should silently return when email not found', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

      const result = await authService.forgotPassword('unknown@test.com');

      expect(result).toBeUndefined();
    });
  });

  describe('resetPassword', () => {
    it('should reset password with valid token', async () => {
      const { resetTokenStore } = await import('../services/reset-token.store');
      vi.mocked(resetTokenStore.get).mockReturnValue({ email: 'user@test.com', expiresAt: new Date(Date.now() + 3600000) });
      vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'user-1', email: 'user@test.com' } as any);
      vi.mocked(prisma.user.update).mockResolvedValue({} as any);
      vi.mocked(bcrypt.hash).mockResolvedValue('new-hashed-password' as never);

      await authService.resetPassword('valid-token', 'newPassword123');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
        }),
      );
      expect(resetTokenStore.delete).toHaveBeenCalledWith('valid-token');
    });

    it('should throw NotFoundError with invalid token', async () => {
      const { resetTokenStore } = await import('../services/reset-token.store');
      vi.mocked(resetTokenStore.get).mockReturnValue(undefined);

      await expect(authService.resetPassword('invalid-token', 'newPassword123')).rejects.toThrow('Invalid or expired reset token');
    });

    it('should throw NotFoundError when user no longer exists', async () => {
      const { resetTokenStore } = await import('../services/reset-token.store');
      vi.mocked(resetTokenStore.get).mockReturnValue({ email: 'user@test.com', expiresAt: new Date(Date.now() + 3600000) });
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

      await expect(authService.resetPassword('valid-token', 'newPassword123')).rejects.toThrow('Invalid or expired reset token');
    });
  });
});
