import { describe, expect, it } from 'vitest';
import { permissionForDashboardPath } from '@/lib/permissions';

describe('permissionForDashboardPath', () => {
  it('protects the financial dashboard at its own route', () => {
    expect(permissionForDashboardPath('/dashboard')).toBe('finance:read');
  });

  it('does not treat the public landing page as the dashboard', () => {
    expect(permissionForDashboardPath('/')).toBeNull();
  });

  it('allows front-desk users to reach their appointments module', () => {
    expect(permissionForDashboardPath('/appointments')).toBe('appointment:read');
  });
});
