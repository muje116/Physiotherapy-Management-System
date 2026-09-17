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

    await prisma.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenant.id}, true)`;
  });
}

export default async function tenantPlugin(fastify: FastifyInstance) {
  setupTenant(fastify);
}
