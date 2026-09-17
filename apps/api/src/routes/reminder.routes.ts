import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createReminderRuleSchema, updateReminderRuleSchema, manualSendSchema, reminderLogQuerySchema } from '@physiocore/schema';
import * as reminderService from '../services/reminder.service';
import { requirePermission } from '../middleware/permissions';
import { auditLog } from '../middleware/audit';

export default async function reminderRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/reminders/rules',
    { preHandler: [requirePermission('settings:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const rules = await reminderService.listRules(request.tenantId);
      return reply.send({ success: true, data: rules });
    }
  );

  fastify.post(
    '/reminders/rules',
    { preHandler: [requirePermission('settings:update')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const data = createReminderRuleSchema.parse(request.body);
      const rule = await reminderService.createRule(request.tenantId, data);
      auditLog('CREATE', 'REMINDER_RULE')(request, reply, { id: rule.id, after: data });
      return reply.status(201).send({ success: true, data: rule });
    }
  );

  fastify.patch(
    '/reminders/rules/:ruleId',
    { preHandler: [requirePermission('settings:update')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { ruleId } = request.params as { ruleId: string };
      const data = updateReminderRuleSchema.parse(request.body);
      const rule = await reminderService.updateRule(request.tenantId, ruleId, data);
      auditLog('UPDATE', 'REMINDER_RULE')(request, reply, { id: ruleId, after: data });
      return reply.send({ success: true, data: rule });
    }
  );

  fastify.delete(
    '/reminders/rules/:ruleId',
    { preHandler: [requirePermission('settings:update')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { ruleId } = request.params as { ruleId: string };
      await reminderService.deleteRule(request.tenantId, ruleId);
      auditLog('DELETE', 'REMINDER_RULE')(request, reply, { id: ruleId });
      return reply.send({ success: true, data: { message: 'Rule deleted' } });
    }
  );

  fastify.post(
    '/reminders/send',
    { preHandler: [requirePermission('settings:update')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const data = manualSendSchema.parse(request.body);
      const result = await reminderService.manualSend(request.tenantId, data);
      auditLog('MANUAL_SEND', 'REMINDER')(request, reply, { after: data });
      return reply.send({ success: true, data: result });
    }
  );

  fastify.get(
    '/reminders/logs',
    { preHandler: [requirePermission('settings:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = reminderLogQuerySchema.parse(request.query);
      const result = await reminderService.getLogs(request.tenantId, query);
      return reply.send({ success: true, data: result.items, meta: { page: result.page, total: result.total } });
    }
  );

  fastify.get(
    '/reminders/stats',
    { preHandler: [requirePermission('settings:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const stats = await reminderService.getStats(request.tenantId);
      return reply.send({ success: true, data: stats });
    }
  );
}
