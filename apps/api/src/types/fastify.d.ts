import 'fastify';
import type { AuthenticatedUser } from './index';

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthenticatedUser;
    tenantId: string;
    tenant: any;
    rawBody?: string;
  }
}
