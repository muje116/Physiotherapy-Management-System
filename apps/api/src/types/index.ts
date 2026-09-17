import { Role } from '@physiocore/db';

export interface JwtPayload {
  sub: string;
  tenantId: string;
  role: Role;
  iat: number;
  exp: number;
}

export interface AuthenticatedUser {
  id: string;
  tenantId: string;
  email: string;
  role: Role;
  firstName: string;
  lastName: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
