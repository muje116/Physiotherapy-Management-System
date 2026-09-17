import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { updateTenantSchema, updateSettingsSchema, updateIntegrationSchema } from '@physiocore/schema';
import * as settingsService from '../services/settings.service';
import { requirePermission } from '../middleware/permissions';
import { auditLog } from '../middleware/audit';

export default async function settingsRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/settings/tenant',
    { preHandler: [requirePermission('settings:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenant = await settingsService.getTenant(request.tenantId);
      return reply.send({ success: true, data: tenant });
    }
  );

  fastify.patch(
    '/settings/tenant',
    { preHandler: [requirePermission('settings:update')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const data = updateTenantSchema.parse(request.body);
      const tenant = await settingsService.updateTenant(request.tenantId, data);
      auditLog('UPDATE', 'TENANT')(request, reply, { id: request.tenantId, after: data });
      return reply.send({ success: true, data: tenant });
    }
  );

  fastify.get(
    '/settings',
    { preHandler: [requirePermission('settings:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const settings = await settingsService.getSettings(request.tenantId);
      return reply.send({ success: true, data: settings });
    }
  );

  fastify.patch(
    '/settings',
    { preHandler: [requirePermission('settings:update')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const data = updateSettingsSchema.parse(request.body);
      const settings = await settingsService.updateSettings(request.tenantId, data);
      auditLog('UPDATE', 'SETTINGS')(request, reply, { after: data });
      return reply.send({ success: true, data: settings });
    }
  );

  fastify.get(
    '/settings/integrations',
    { preHandler: [requirePermission('settings:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const integrations = await settingsService.getIntegrations(request.tenantId);
      return reply.send({ success: true, data: integrations });
    }
  );

  fastify.patch(
    '/settings/integrations/:key',
    { preHandler: [requirePermission('settings:update')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { key } = request.params as { key: string };
      const data = updateIntegrationSchema.parse(request.body);
      const integration = await settingsService.updateIntegration(request.tenantId, key, data);
      auditLog('UPDATE_INTEGRATION', 'SETTINGS')(request, reply, { after: { key, ...data } });
      return reply.send({ success: true, data: integration });
    }
  );
}
