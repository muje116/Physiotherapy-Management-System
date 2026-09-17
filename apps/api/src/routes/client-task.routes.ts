import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { clientTaskQuerySchema, createClientTaskSchema, updateClientTaskSchema } from '@physiocore/schema';
import * as clientTaskService from '../services/client-task.service';
import { requirePermission } from '../middleware/permissions';
import { auditLog } from '../middleware/audit';

export default async function clientTaskRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/client-tasks',
    { preHandler: [requirePermission('client_task:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = clientTaskQuerySchema.parse(request.query);
      const result = await clientTaskService.listTasks(request.tenantId, query);
      return reply.send({ success: true, data: result.items, meta: { page: result.page, total: result.total, limit: result.limit } });
    }
  );

  fastify.post(
    '/client-tasks',
    { preHandler: [requirePermission('client_task:create')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const data = createClientTaskSchema.parse(request.body);
      const task = await clientTaskService.createTask(request.tenantId, request.user.id, data);
      auditLog('CREATE', 'CLIENT_TASK')(request, reply, { id: task.id, after: data });
      return reply.status(201).send({ success: true, data: task });
    }
  );

  fastify.patch(
    '/client-tasks/:id',
    { preHandler: [requirePermission('client_task:update')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const data = updateClientTaskSchema.parse(request.body);
      const task = await clientTaskService.updateTask(request.tenantId, id, data);
      auditLog('UPDATE', 'CLIENT_TASK')(request, reply, { id, after: data });
      return reply.send({ success: true, data: task });
    }
  );

  fastify.post(
    '/client-tasks/:id/complete',
    { preHandler: [requirePermission('client_task:update')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const task = await clientTaskService.completeTask(request.tenantId, id);
      auditLog('COMPLETE', 'CLIENT_TASK')(request, reply, { id });
      return reply.send({ success: true, data: task });
    }
  );

  fastify.post(
    '/client-tasks/:id/send-email',
    { preHandler: [requirePermission('client_task:update')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const result = await clientTaskService.sendTaskEmail(request.tenantId, id);
      auditLog('SEND_EMAIL', 'CLIENT_TASK')(request, reply, { id });
      return reply.send({ success: true, data: { message: 'Email sent' } });
    }
  );

  fastify.get(
    '/client-tasks/stats',
    { preHandler: [requirePermission('client_task:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const stats = await clientTaskService.getTaskStats(request.tenantId);
      return reply.send({ success: true, data: stats });
    }
  );
}
