export type DashboardPermission =
  | 'patient:read'
  | 'appointment:read'
  | 'soap_note:read'
  | 'finance:read'
  | 'settings:read'
  | 'notification:read'
  | 'payment:read'
  | 'scheme:read'
  | 'treatment:read'
  | 'client_task:read'
  | 'inventory:read';

/**
 * The dashboard uses the same read permissions as the API route that powers
 * each module. Keeping this map in one place prevents the sidebar and direct
 * URL navigation from drifting away from server-side authorization.
 */
export const DASHBOARD_ROUTE_PERMISSIONS: Record<string, DashboardPermission> = {
  '/patients': 'patient:read',
  '/appointments': 'appointment:read',
  '/therapists': 'patient:read',
  '/soap-notes': 'soap_note:read',
  '/invoices': 'finance:read',
  '/exercise-plans': 'patient:read',
  '/marketing': 'settings:read',
  '/notifications': 'notification:read',
  '/payments': 'payment:read',
  '/medical-schemes': 'scheme:read',
  '/treatment-plans': 'treatment:read',
  '/client-tasks': 'client_task:read',
  '/inventory': 'inventory:read',
  '/reports': 'finance:read',
  '/settings': 'settings:read',
  '/users': 'settings:read',
  '/reminders': 'settings:read',
};

export function permissionForDashboardPath(pathname: string): DashboardPermission | null {
  const matchingPath = Object.keys(DASHBOARD_ROUTE_PERMISSIONS)
    .filter((path) => pathname === path || pathname.startsWith(`${path}/`))
    .sort((left, right) => right.length - left.length)[0];

  return matchingPath ? DASHBOARD_ROUTE_PERMISSIONS[matchingPath] : null;
}

export function hasPermission(user: { permissions?: string[] } | null | undefined, permission: string) {
  return Boolean(user?.permissions?.includes(permission));
}
