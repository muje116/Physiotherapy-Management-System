import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcrypt';

vi.mock('@physiocore/db', () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
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

vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn(() => 'hashed-password'),
    compare: vi.fn(),
  },
  hash: vi.fn(() => 'hashed-password'),
  compare: vi.fn(),
}));

import { prisma, Role } from '@physiocore/db';
import * as userService from '../services/user.service';

describe('user.service', () => {
  const tenantId = 'tenant-1';
  const mockUser = {
    id: 'user-1',
    tenantId,
    email: 'user@test.com',
    passwordHash: 'hashed',
    firstName: 'Test',
    lastName: 'User',
    role: Role.THERAPIST,
    isActive: true,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('list', () => {
    it('should return paginated users', async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        { id: 'user-1', email: 'a@b.com', firstName: 'A', lastName: 'B', role: Role.THERAPIST, isActive: true, lastLoginAt: null, createdAt: new Date(), updatedAt: new Date() },
      ] as any);
      vi.mocked(prisma.user.count).mockResolvedValue(1);

      const result = await userService.list(tenantId, { page: 1, limit: 10 });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it('should filter by role', async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValue([]);
      vi.mocked(prisma.user.count).mockResolvedValue(0);

      await userService.list(tenantId, { page: 1, limit: 10, role: Role.THERAPIST });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ role: Role.THERAPIST }),
        }),
      );
    });

    it('should filter by search query', async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValue([]);
      vi.mocked(prisma.user.count).mockResolvedValue(0);

      await userService.list(tenantId, { page: 1, limit: 10, search: 'John' });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ firstName: { contains: 'John', mode: 'insensitive' } }),
            ]),
          }),
        }),
      );
    });

    it('should exclude passwordHash from results', async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValue([]);
      vi.mocked(prisma.user.count).mockResolvedValue(0);

      await userService.list(tenantId, { page: 1, limit: 10 });

      const select = (prisma.user.findMany as any).mock.calls[0][0].select;
      expect(select).not.toHaveProperty('passwordHash');
    });
  });

  describe('create', () => {
    const validData = {
      email: 'newuser@test.com',
      password: 'password123',
      firstName: 'New',
      lastName: 'User',
      role: Role.THERAPIST,
    };

    it('should create a user with hashed password', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.create).mockResolvedValue({
        id: 'user-2',
        email: 'newuser@test.com',
        firstName: 'New',
        lastName: 'User',
        role: Role.THERAPIST,
        isActive: true,
        createdAt: new Date(),
      } as any);

      await userService.create(tenantId, validData);

      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            passwordHash: 'hashed-password',
            tenantId,
          }),
        }),
      );
    });

    it('should throw ConflictError if email exists in tenant', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'existing' } as any);

      await expect(userService.create(tenantId, validData)).rejects.toThrow('Email already exists in this tenant');
    });
  });

  describe('getById', () => {
    it('should return user by id within tenant', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser as any);

      const result = await userService.getById(tenantId, 'user-1');
      expect(result.id).toBe('user-1');
    });

    it('should throw NotFoundError for non-existent user', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

      await expect(userService.getById(tenantId, 'user-999')).rejects.toThrow('User not found');
    });
  });

  describe('update', () => {
    it('should update user fields', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser as any);
      vi.mocked(prisma.user.update).mockResolvedValue({ ...mockUser, firstName: 'Updated' } as any);

      const result = await userService.update(tenantId, 'user-1', { firstName: 'Updated' });

      expect((result as any).firstName).toBe('Updated');
    });

    it('should prevent changing SUPER_ADMIN role', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue({ ...mockUser, role: Role.SUPER_ADMIN } as any);

      await expect(
        userService.update(tenantId, 'user-1', { role: Role.ADMIN }),
      ).rejects.toThrow('Cannot change SUPER_ADMIN role');
    });

    it('should allow updating SUPER_ADMIN to same role', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue({ ...mockUser, role: Role.SUPER_ADMIN } as any);
      vi.mocked(prisma.user.update).mockResolvedValue({ ...mockUser, role: Role.SUPER_ADMIN } as any);

      const result = await userService.update(tenantId, 'user-1', { role: Role.SUPER_ADMIN });

      expect((result as any).role).toBe(Role.SUPER_ADMIN);
    });

    it('should throw NotFoundError for non-existent', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

      await expect(userService.update(tenantId, 'user-999', { firstName: 'Test' })).rejects.toThrow('User not found');
    });
  });

  describe('deactivate', () => {
    it('should set isActive to false', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser as any);
      vi.mocked(prisma.user.update).mockResolvedValue({ id: 'user-1', isActive: false } as any);

      const result = await userService.deactivate(tenantId, 'user-1');

      expect(result.isActive).toBe(false);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: { isActive: false },
        }),
      );
    });

    it('should throw ConflictError when trying to deactivate SUPER_ADMIN', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue({ ...mockUser, role: Role.SUPER_ADMIN } as any);

      await expect(userService.deactivate(tenantId, 'user-1')).rejects.toThrow('Cannot deactivate SUPER_ADMIN');
    });

    it('should throw NotFoundError for non-existent user', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

      await expect(userService.deactivate(tenantId, 'user-999')).rejects.toThrow('User not found');
    });
  });

  describe('resetPassword', () => {
    it('should reset password for a user', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser as any);
      vi.mocked(prisma.user.update).mockResolvedValue({} as any);

      await userService.resetPassword(tenantId, 'user-1', 'newPassword123');

      expect(bcrypt.hash).toHaveBeenCalledWith('newPassword123', 10);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({ passwordHash: 'hashed-password' }),
        }),
      );
    });

    it('should throw NotFoundError for non-existent user', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

      await expect(userService.resetPassword(tenantId, 'user-999', 'newPass123')).rejects.toThrow('User not found');
    });
  });
});
