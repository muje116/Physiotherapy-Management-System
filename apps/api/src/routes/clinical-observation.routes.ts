import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { createClinicalObservationSchema } from '@physiocore/schema';
import * as clinicalObservationService from '../services/clinical-observation.service';
import { requirePermission } from '../middleware/permissions';
import { auditLog } from '../middleware/audit';

export default async function clinicalObservationRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/patients/:patientId/clinical-observations',
    { preHandler: [requirePermission('clinical_observation:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { patientId } = request.params as { patientId: string };
      const observations = await clinicalObservationService.list(request.tenantId, patientId);
      return reply.send({ success: true, data: observations });
    },
  );

  fastify.post(
    '/patients/:patientId/clinical-observations',
    { preHandler: [requirePermission('clinical_observation:write')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { patientId } = request.params as { patientId: string };
      const data = createClinicalObservationSchema.parse(request.body);
      const observation = await clinicalObservationService.create(
        request.tenantId,
        patientId,
        request.user.id,
        data,
      );
      auditLog('CREATE', 'CLINICAL_OBSERVATION')(request, reply, { id: observation.id });
      return reply.status(201).send({ success: true, data: observation });
    },
  );
}
