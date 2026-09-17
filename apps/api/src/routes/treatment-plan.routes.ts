import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as treatmentPlanService from '../services/treatment-plan.service';
import { requirePermission } from '../middleware/permissions';
import { auditLog } from '../middleware/audit';
import {
  createTreatmentPlanSchema,
  createTreatmentPlanStageSchema,
  updateTreatmentPlanSchema,
  updateTreatmentPlanStageSchema,
  treatmentPlanQuerySchema,
} from '@physiocore/schema';

export default async function treatmentPlanRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/treatment-plans',
    { preHandler: [requirePermission('treatment:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = treatmentPlanQuerySchema.parse(request.query);
      const result = await treatmentPlanService.listPlans(request.tenantId, query);
      return reply.send({ success: true, data: result.items, meta: { page: result.page, total: result.total, limit: result.limit } });
    }
  );

  fastify.post(
    '/treatment-plans',
    { preHandler: [requirePermission('treatment:write')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const data = createTreatmentPlanSchema.parse(request.body);
      const plan = await treatmentPlanService.createPlan(request.tenantId, data);
      auditLog('CREATE', 'TREATMENT_PLAN')(request, reply, { id: plan.id, after: data });
      return reply.status(201).send({ success: true, data: plan });
    }
  );

  fastify.get(
    '/treatment-plans/:id',
    { preHandler: [requirePermission('treatment:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const plan = await treatmentPlanService.getPlan(request.tenantId, id);
      return reply.send({ success: true, data: plan });
    }
  );

  fastify.patch(
    '/treatment-plans/:id',
    { preHandler: [requirePermission('treatment:write')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const data = updateTreatmentPlanSchema.parse(request.body);
      const plan = await treatmentPlanService.updatePlan(request.tenantId, id, data);
      auditLog('UPDATE', 'TREATMENT_PLAN')(request, reply, { id, after: data });
      return reply.send({ success: true, data: plan });
    }
  );

  fastify.post(
    '/treatment-plans/:id/stages',
    { preHandler: [requirePermission('treatment:write')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const data = createTreatmentPlanStageSchema.parse(request.body);
      const stage = await treatmentPlanService.addStage(request.tenantId, id, data);
      auditLog('ADD_STAGE', 'TREATMENT_PLAN')(request, reply, { planId: id, after: data });
      return reply.status(201).send({ success: true, data: stage });
    }
  );

  fastify.patch(
    '/treatment-plans/:id/stages/:stageId',
    { preHandler: [requirePermission('treatment:write')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id, stageId } = request.params as { id: string; stageId: string };
      const data = updateTreatmentPlanStageSchema.parse(request.body);
      const stage = await treatmentPlanService.updateStage(request.tenantId, id, stageId, data);
      auditLog('UPDATE_STAGE', 'TREATMENT_PLAN')(request, reply, { planId: id, stageId, after: data });
      return reply.send({ success: true, data: stage });
    }
  );

  fastify.post(
    '/treatment-plans/:id/complete',
    { preHandler: [requirePermission('treatment:write')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const plan = await treatmentPlanService.completePlan(request.tenantId, id);
      auditLog('COMPLETE', 'TREATMENT_PLAN')(request, reply, { id });
      return reply.send({ success: true, data: plan });
    }
  );

  fastify.get(
    '/treatment-plans/:id/client-tasks',
    { preHandler: [requirePermission('treatment:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const plan = await treatmentPlanService.getPlan(request.tenantId, id);
      return reply.send({ success: true, data: plan?.clientTasks || [] });
    }
  );
}
