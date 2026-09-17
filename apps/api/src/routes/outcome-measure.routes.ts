import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { updateOutcomeMeasureSchema } from '@physiocore/schema';
import { requirePermission } from '../middleware/permissions';
import { auditLog } from '../middleware/audit';
import * as outcomeMeasureService from '../services/outcome-measure.service';

export default async function outcomeMeasureRoutes(fastify: FastifyInstance) {
  fastify.patch(
    '/outcome-measures/:id',
    { preHandler: [requirePermission('patient:update')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const data = updateOutcomeMeasureSchema.parse(request.body);
      const measure = await outcomeMeasureService.update(request.tenantId, id, data);
      auditLog('UPDATE', 'OUTCOME_MEASURE')(request, reply, { id, after: data });
      return reply.send({ success: true, data: measure });
    },
  );

  fastify.delete(
    '/outcome-measures/:id',
    { preHandler: [requirePermission('patient:update')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      await outcomeMeasureService.remove(request.tenantId, id);
      auditLog('DELETE', 'OUTCOME_MEASURE')(request, reply, { id });
      return reply.send({ success: true, data: { message: 'Outcome measure deleted' } });
    },
  );
}
