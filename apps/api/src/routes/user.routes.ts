import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createUserSchema, updateUserSchema, userQuerySchema, resetUserPasswordSchema } from '@physiocore/schema';
import * as userService from '../services/user.service';
import { requirePermission } from '../middleware/permissions';
import { auditLog } from '../middleware/audit';

export default async function userRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/users',
    { preHandler: [requirePermission('settings:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = userQuerySchema.parse(request.query);
      const result = await userService.list(request.tenantId, query);
      return reply.send({ success: true, data: result.items, meta: { page: result.page, total: result.total } });
    }
  );

  fastify.post(
    '/users',
    { preHandler: [requirePermission('settings:update')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const data = createUserSchema.parse(request.body);
      const user = await userService.create(request.tenantId, data);
      auditLog('CREATE', 'USER')(request, reply, { id: user.id, after: data });
      return reply.status(201).send({ success: true, data: user });
    }
  );

  fastify.get(
    '/users/:userId',
    { preHandler: [requirePermission('settings:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { userId } = request.params as { userId: string };
      const user = await userService.getById(request.tenantId, userId);
      return reply.send({ success: true, data: user });
    }
  );

  fastify.patch(
    '/users/:userId',
    { preHandler: [requirePermission('settings:update')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { userId } = request.params as { userId: string };
      const data = updateUserSchema.parse(request.body);
      const user = await userService.update(request.tenantId, userId, data);
      auditLog('UPDATE', 'USER')(request, reply, { id: userId, before: {}, after: data });
      return reply.send({ success: true, data: user });
    }
  );

  fastify.delete(
    '/users/:userId',
    { preHandler: [requirePermission('settings:update')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { userId } = request.params as { userId: string };
      await userService.deactivate(request.tenantId, userId);
      auditLog('DEACTIVATE', 'USER')(request, reply, { id: userId });
      return reply.send({ success: true, data: { message: 'User deactivated' } });
    }
  );

  fastify.post(
    '/users/:userId/reset-password',
    { preHandler: [requirePermission('settings:update')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { userId } = request.params as { userId: string };
      const data = resetUserPasswordSchema.parse(request.body);
      await userService.resetPassword(request.tenantId, userId, data.newPassword);
      auditLog('RESET_PASSWORD', 'USER')(request, reply, { id: userId });
      return reply.send({ success: true, data: { message: 'Password reset successfully' } });
    }
  );
}
