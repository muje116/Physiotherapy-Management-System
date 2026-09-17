import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as notificationService from '../services/notification.service';
import { requirePermission } from '../middleware/permissions';
import { auditLog } from '../middleware/audit';
import {
  createNotificationChannelSchema,
  createNotificationTemplateSchema,
  updateNotificationChannelSchema,
  updateNotificationTemplateSchema,
} from '@physiocore/schema';
import { followUpQuerySchema, updateFollowUpSchema } from '@physiocore/schema';

export default async function notificationRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/notifications/templates',
    { preHandler: [requirePermission('settings:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const templates = await notificationService.listTemplates(request.tenantId);
      return reply.send({ success: true, data: templates });
    }
  );

  fastify.post(
    '/notifications/templates',
    { preHandler: [requirePermission('settings:update')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const data = createNotificationTemplateSchema.parse(request.body);
      const template = await notificationService.createTemplate(request.tenantId, data);
      auditLog('CREATE', 'NOTIFICATION_TEMPLATE')(request, reply, { id: template.id, after: data });
      return reply.status(201).send({ success: true, data: template });
    }
  );

  fastify.patch(
    '/notifications/templates/:id',
    { preHandler: [requirePermission('settings:update')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const data = updateNotificationTemplateSchema.parse(request.body);
      const template = await notificationService.updateTemplate(request.tenantId, id, data);
      auditLog('UPDATE', 'NOTIFICATION_TEMPLATE')(request, reply, { id, after: data });
      return reply.send({ success: true, data: template });
    }
  );

  fastify.delete(
    '/notifications/templates/:id',
    { preHandler: [requirePermission('settings:update')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      await notificationService.deleteTemplate(request.tenantId, id);
      auditLog('DELETE', 'NOTIFICATION_TEMPLATE')(request, reply, { id });
      return reply.send({ success: true, message: 'Template deleted' });
    }
  );

  fastify.get(
    '/notifications/channels',
    { preHandler: [requirePermission('settings:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const channels = await notificationService.listChannels(request.tenantId);
      return reply.send({ success: true, data: channels });
    }
  );

  fastify.post(
    '/notifications/channels',
    { preHandler: [requirePermission('settings:update')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const data = createNotificationChannelSchema.parse(request.body);
      const channel = await notificationService.upsertChannel(request.tenantId, data.type, data);
      auditLog('UPSERT', 'NOTIFICATION_CHANNEL')(request, reply, { id: channel.id, after: data });
      return reply.status(201).send({ success: true, data: channel });
    }
  );

  fastify.patch(
    '/notifications/channels/:id',
    { preHandler: [requirePermission('settings:update')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const data = updateNotificationChannelSchema.parse(request.body);
      const updateData = data;
      const channel = await notificationService.updateChannel(request.tenantId, id, updateData);
      auditLog('UPDATE', 'NOTIFICATION_CHANNEL')(request, reply, { id, after: updateData });
      return reply.send({ success: true, data: channel });
    }
  );

  fastify.get(
    '/notifications/follow-ups',
    { preHandler: [requirePermission('settings:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = followUpQuerySchema.parse(request.query);
      const result = await notificationService.listFollowUps(request.tenantId, query);
      return reply.send({ success: true, data: result.items, meta: { page: result.page, total: result.total, limit: result.limit } });
    }
  );

  fastify.patch(
    '/notifications/follow-ups/:id',
    { preHandler: [requirePermission('settings:update')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const data = updateFollowUpSchema.parse(request.body);
      const followUp = await notificationService.updateFollowUp(request.tenantId, id, data);
      auditLog('UPDATE', 'FOLLOW_UP')(request, reply, { id, after: data });
      return reply.send({ success: true, data: followUp });
    }
  );

  fastify.get(
    '/notifications/follow-ups/stats',
    { preHandler: [requirePermission('settings:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const stats = await notificationService.getFollowUpStats(request.tenantId);
      return reply.send({ success: true, data: stats });
    }
  );
}
