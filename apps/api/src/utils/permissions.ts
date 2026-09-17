import { Role } from '@physiocore/db';

export const PERMISSIONS = {
  'patient:read': [Role.SUPER_ADMIN, Role.ADMIN, Role.THERAPIST, Role.FRONT_DESK, Role.BILLING],
  'patient:create': [Role.SUPER_ADMIN, Role.ADMIN, Role.THERAPIST, Role.FRONT_DESK],
  'patient:update': [Role.SUPER_ADMIN, Role.ADMIN, Role.THERAPIST, Role.FRONT_DESK],
  'patient:delete': [Role.SUPER_ADMIN, Role.ADMIN, Role.FRONT_DESK],

  'appointment:read': [Role.SUPER_ADMIN, Role.ADMIN, Role.THERAPIST, Role.FRONT_DESK, Role.BILLING],
  'appointment:create': [Role.SUPER_ADMIN, Role.ADMIN, Role.THERAPIST, Role.FRONT_DESK],
  'appointment:update': [Role.SUPER_ADMIN, Role.ADMIN, Role.THERAPIST, Role.FRONT_DESK],
  'appointment:delete': [Role.SUPER_ADMIN, Role.ADMIN, Role.FRONT_DESK],

  'soap_note:read': [Role.SUPER_ADMIN, Role.ADMIN, Role.THERAPIST],
  'soap_note:create': [Role.SUPER_ADMIN, Role.ADMIN, Role.THERAPIST],
  'soap_note:update': [Role.SUPER_ADMIN, Role.ADMIN, Role.THERAPIST],
  'soap_note:sign': [Role.SUPER_ADMIN, Role.ADMIN, Role.THERAPIST],
  'soap_note:delete': [Role.SUPER_ADMIN, Role.ADMIN],

  'finance:read': [Role.SUPER_ADMIN, Role.ADMIN, Role.BILLING],
  'finance:export': [Role.SUPER_ADMIN, Role.ADMIN, Role.BILLING],
  'finance:create': [Role.SUPER_ADMIN, Role.ADMIN, Role.BILLING],
  'finance:update': [Role.SUPER_ADMIN, Role.ADMIN, Role.BILLING],
  'finance:delete': [Role.SUPER_ADMIN, Role.ADMIN],

  'settings:read': [Role.SUPER_ADMIN, Role.ADMIN],
  'settings:update': [Role.SUPER_ADMIN, Role.ADMIN],

  'tenant:billing': [Role.SUPER_ADMIN],

  'notification:read': [Role.SUPER_ADMIN, Role.ADMIN, Role.FRONT_DESK],
  'notification:write': [Role.SUPER_ADMIN, Role.ADMIN],
  'payment:read': [Role.SUPER_ADMIN, Role.ADMIN, Role.BILLING, Role.FRONT_DESK],
  'payment:create': [Role.SUPER_ADMIN, Role.ADMIN, Role.BILLING, Role.FRONT_DESK],
  'scheme:read': [Role.SUPER_ADMIN, Role.ADMIN, Role.BILLING],
  'scheme:write': [Role.SUPER_ADMIN, Role.ADMIN, Role.BILLING],
  'treatment:read': [Role.SUPER_ADMIN, Role.ADMIN, Role.THERAPIST],
  'treatment:write': [Role.SUPER_ADMIN, Role.ADMIN, Role.THERAPIST],
  'client_task:read': [Role.SUPER_ADMIN, Role.ADMIN, Role.THERAPIST],
  'client_task:create': [Role.SUPER_ADMIN, Role.ADMIN, Role.THERAPIST],
  'client_task:update': [Role.SUPER_ADMIN, Role.ADMIN, Role.THERAPIST],
} as const;

export type Permission = keyof typeof PERMISSIONS;
