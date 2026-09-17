import { describe, it, expect, vi } from 'vitest';
import { Role } from '@physiocore/db';
import { PERMISSIONS, Permission } from '../utils/permissions';
import { ForbiddenError } from '../utils/errors';

// We test requirePermission by evaluating its closure logic
describe('PERMISSIONS', () => {
  it('should have all required permission keys', () => {
    const expectedKeys = [
      'patient:read',
      'patient:create',
      'patient:update',
      'patient:delete',
      'appointment:read',
      'appointment:create',
      'appointment:update',
      'appointment:delete',
      'soap_note:read',
      'soap_note:create',
      'soap_note:update',
      'soap_note:sign',
      'soap_note:delete',
      'finance:read',
      'finance:export',
      'finance:create',
      'finance:update',
      'finance:delete',
      'settings:read',
      'settings:update',
      'tenant:billing',
    ];

    for (const key of expectedKeys) {
      expect(PERMISSIONS).toHaveProperty(key);
    }
  });

  it('should allow SUPER_ADMIN access to all permissions', () => {
    const keys = Object.keys(PERMISSIONS) as Permission[];
    for (const key of keys) {
      const roles = PERMISSIONS[key] as readonly Role[];
      expect(roles).toContain(Role.SUPER_ADMIN);
    }
  });

  it('should not allow PATIENT role in any permission', () => {
    const keys = Object.keys(PERMISSIONS) as Permission[];
    for (const key of keys) {
      const roles = PERMISSIONS[key] as readonly Role[];
      expect(roles).not.toContain(Role.PATIENT);
    }
  });

  it('should allow FRONT_DESK patient and appointment permissions', () => {
    const allowed: Permission[] = [
      'patient:read',
      'patient:create',
      'patient:update',
      'patient:delete',
      'appointment:read',
      'appointment:create',
      'appointment:update',
      'appointment:delete',
    ];

    for (const key of allowed) {
      expect(PERMISSIONS[key]).toContain(Role.FRONT_DESK);
    }
  });

  it('should deny FRONT_DESK soap_note and finance permissions', () => {
    const denied: Permission[] = [
      'soap_note:read',
      'soap_note:create',
      'soap_note:update',
      'soap_note:sign',
      'soap_note:delete',
      'finance:read',
      'finance:export',
      'finance:create',
      'finance:update',
      'finance:delete',
    ];

    for (const key of denied) {
      expect(PERMISSIONS[key]).not.toContain(Role.FRONT_DESK);
    }
  });

  it('should allow BILLING only finance permissions', () => {
    const financePermissions: Permission[] = [
      'finance:read',
      'finance:export',
      'finance:create',
      'finance:update',
    ];

    for (const key of financePermissions) {
      expect(PERMISSIONS[key]).toContain(Role.BILLING);
    }

    expect(PERMISSIONS['finance:delete']).toContain(Role.SUPER_ADMIN);
    expect(PERMISSIONS['finance:delete']).toContain(Role.ADMIN);
  });

  it('should restrict tenant:billing to SUPER_ADMIN only', () => {
    expect(PERMISSIONS['tenant:billing']).toEqual([Role.SUPER_ADMIN]);
  });
});

describe('requirePermission', () => {
  it('should not throw when user has the required role', async () => {
    const { requirePermission } = await import('../middleware/permissions');

    const mockRequest = {
      user: { role: Role.ADMIN },
    } as any;
    const mockReply = {} as any;

    const handler = requirePermission('patient:read');
    await expect(handler(mockRequest, mockReply)).resolves.toBeUndefined();
  });

  it('should throw ForbiddenError when user lacks the required role', async () => {
    const { requirePermission } = await import('../middleware/permissions');

    const mockRequest = {
      user: { role: Role.FRONT_DESK },
    } as any;
    const mockReply = {} as any;

    const handler = requirePermission('soap_note:create');
    await expect(handler(mockRequest, mockReply)).rejects.toThrow(ForbiddenError);
  });

  it('should throw ForbiddenError when user has no matching role', async () => {
    const { requirePermission } = await import('../middleware/permissions');

    const mockRequest = {
      user: { role: Role.PATIENT },
    } as any;
    const mockReply = {} as any;

    const handler = requirePermission('patient:read');
    await expect(handler(mockRequest, mockReply)).rejects.toThrow(ForbiddenError);
  });
});
