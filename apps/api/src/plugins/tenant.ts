import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@physiocore/db';
import { ForbiddenError } from '../utils/errors';

export function setupTenant(fastify: FastifyInstance) {
  fastify.decorateRequest('tenant', null);

  fastify.addHook('onRequest', async (request: FastifyRequest, _reply: FastifyReply) => {
    if (!request.tenantId) return;

    const tenant = await prisma.tenant.findUnique({
      where: { id: request.tenantId },
    });

    if (!tenant || !tenant.isActive) {
      throw new ForbiddenError('Tenant not found or inactive');
    }

    request.tenant = tenant;

    // Tenant-owned service queries must always include tenantId explicitly.
    // Do not set a transaction-local PostgreSQL setting here: Fastify hooks
    // and Prisma queries can use different pooled connections.
  });
}

export default async function tenantPlugin(fastify: FastifyInstance) {
  setupTenant(fastify);
}
