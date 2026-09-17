import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createExercisePlanSchema, updateExercisePlanSchema, createExercisePlanItemSchema, updateExercisePlanItemSchema, paginationSchema } from '@physiocore/schema';
import * as exercisePlanService from '../services/exercise-plan.service';
import { requirePermission } from '../middleware/permissions';
import { auditLog } from '../middleware/audit';

export default async function exercisePlanRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/exercise-plans',
    { preHandler: [requirePermission('patient:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = paginationSchema.parse(request.query);
      const result = await exercisePlanService.list(request.tenantId, query);
      return reply.send({ success: true, data: result.items, meta: { page: result.page, total: result.total } });
    }
  );

  fastify.post(
    '/exercise-plans',
    { preHandler: [requirePermission('patient:create')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const data = createExercisePlanSchema.parse(request.body);
      const plan = await exercisePlanService.create(request.tenantId, data);
      auditLog('CREATE', 'EXERCISE_PLAN')(request, reply, { id: plan.id, after: data });
      return reply.status(201).send({ success: true, data: plan });
    }
  );

  fastify.get(
    '/exercise-plans/:planId',
    { preHandler: [requirePermission('patient:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { planId } = request.params as { planId: string };
      const plan = await exercisePlanService.getById(request.tenantId, planId);
      return reply.send({ success: true, data: plan });
    }
  );

  fastify.patch(
    '/exercise-plans/:planId',
    { preHandler: [requirePermission('patient:update')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { planId } = request.params as { planId: string };
      const data = updateExercisePlanSchema.parse(request.body);
      const plan = await exercisePlanService.update(request.tenantId, planId, data);
      auditLog('UPDATE', 'EXERCISE_PLAN')(request, reply, { id: planId, after: data });
      return reply.send({ success: true, data: plan });
    }
  );

  fastify.post(
    '/exercise-plans/:planId/send',
    { preHandler: [requirePermission('patient:update')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { planId } = request.params as { planId: string };
      const plan = await exercisePlanService.send(request.tenantId, planId);
      auditLog('SEND', 'EXERCISE_PLAN')(request, reply, { id: planId });
      return reply.send({ success: true, data: { message: 'Exercise plan queued for sending' } });
    }
  );

  fastify.post(
    '/exercise-plans/:planId/items',
    { preHandler: [requirePermission('patient:create')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { planId } = request.params as { planId: string };
      const data = createExercisePlanItemSchema.parse(request.body);
      const item = await exercisePlanService.addItem(request.tenantId, planId, data);
      return reply.status(201).send({ success: true, data: item });
    }
  );

  fastify.patch(
    '/exercise-plans/:planId/items/:itemId',
    { preHandler: [requirePermission('patient:update')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { planId, itemId } = request.params as { planId: string; itemId: string };
      const data = updateExercisePlanItemSchema.parse(request.body);
      const item = await exercisePlanService.updateItem(request.tenantId, planId, itemId, data);
      return reply.send({ success: true, data: item });
    }
  );

  fastify.delete(
    '/exercise-plans/:planId/items/:itemId',
    { preHandler: [requirePermission('patient:delete')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { planId, itemId } = request.params as { planId: string; itemId: string };
      await exercisePlanService.removeItem(request.tenantId, planId, itemId);
      auditLog('DELETE', 'EXERCISE_PLAN_ITEM')(request, reply, { id: itemId });
      return reply.send({ success: true, data: { message: 'Item removed' } });
    }
  );
}
