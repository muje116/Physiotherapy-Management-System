import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createTherapistSchema, updateTherapistSchema, createScheduleBlockSchema, scheduleQuerySchema } from '@physiocore/schema';
import * as therapistService from '../services/therapist.service';
import { requirePermission } from '../middleware/permissions';
import { auditLog } from '../middleware/audit';

export default async function therapistRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/therapists',
    { preHandler: [requirePermission('patient:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const therapists = await therapistService.list(request.tenantId);
      return reply.send({ success: true, data: therapists });
    }
  );

  fastify.post(
    '/therapists',
    { preHandler: [requirePermission('settings:update')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const data = createTherapistSchema.parse(request.body);
      const therapist = await therapistService.create(request.tenantId, data);
      auditLog('CREATE', 'THERAPIST')(request, reply, { id: therapist.id, after: data });
      return reply.status(201).send({ success: true, data: therapist });
    }
  );

  fastify.get(
    '/therapists/:therapistId',
    { preHandler: [requirePermission('patient:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { therapistId } = request.params as { therapistId: string };
      const therapist = await therapistService.getById(request.tenantId, therapistId);
      return reply.send({ success: true, data: therapist });
    }
  );

  fastify.patch(
    '/therapists/:therapistId',
    { preHandler: [requirePermission('settings:update')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { therapistId } = request.params as { therapistId: string };
      const data = updateTherapistSchema.parse(request.body);
      const therapist = await therapistService.update(request.tenantId, therapistId, data);
      auditLog('UPDATE', 'THERAPIST')(request, reply, { id: therapistId, after: data });
      return reply.send({ success: true, data: therapist });
    }
  );

  fastify.get(
    '/therapists/:therapistId/schedule',
    { preHandler: [requirePermission('appointment:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { therapistId } = request.params as { therapistId: string };
      const query = scheduleQuerySchema.parse(request.query);
      const schedule = await therapistService.getSchedule(request.tenantId, therapistId, query.startDate, query.endDate);
      return reply.send({ success: true, data: schedule });
    }
  );

  fastify.post(
    '/therapists/:therapistId/schedule',
    { preHandler: [requirePermission('appointment:create')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { therapistId } = request.params as { therapistId: string };
      const data = createScheduleBlockSchema.parse(request.body);
      const block = await therapistService.addScheduleBlock(request.tenantId, therapistId, data);
      return reply.status(201).send({ success: true, data: block });
    }
  );

  fastify.delete(
    '/therapists/:therapistId/schedule/:blockId',
    { preHandler: [requirePermission('appointment:update')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { therapistId, blockId } = request.params as { therapistId: string; blockId: string };
      await therapistService.removeScheduleBlock(request.tenantId, therapistId, blockId);
      auditLog('DELETE', 'SCHEDULE_BLOCK')(request, reply, { id: blockId });
      return reply.send({ success: true, data: { message: 'Schedule block removed' } });
    }
  );

  fastify.get(
    '/therapists/:therapistId/patients',
    { preHandler: [requirePermission('patient:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { therapistId } = request.params as { therapistId: string };
      const patients = await therapistService.getPatients(request.tenantId, therapistId);
      return reply.send({ success: true, data: patients });
    }
  );

  fastify.get(
    '/therapists/:therapistId/utilisation',
    { preHandler: [requirePermission('appointment:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { therapistId } = request.params as { therapistId: string };
      const query = scheduleQuerySchema.parse(request.query);
      const utilisation = await therapistService.getUtilisation(request.tenantId, therapistId, query.startDate, query.endDate);
      return reply.send({ success: true, data: utilisation });
    }
  );
}
