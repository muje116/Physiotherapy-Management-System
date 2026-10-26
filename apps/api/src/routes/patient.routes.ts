import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createOutcomeMeasureSchema, createPatientSchema, updatePatientSchema, patientQuerySchema } from '@physiocore/schema';
import * as patientService from '../services/patient.service';
import * as outcomeMeasureService from '../services/outcome-measure.service';
import { requirePermission } from '../middleware/permissions';
import { auditLog } from '../middleware/audit';

export default async function patientRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/patients',
    { preHandler: [requirePermission('patient:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = patientQuerySchema.parse(request.query);
      const result = await patientService.list(request.tenantId, query, request.user.id, request.user.role);
      return reply.send({ success: true, data: result.items, meta: { page: result.page, total: result.total } });
    }
  );

  fastify.post(
    '/patients',
    { preHandler: [requirePermission('patient:create')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const data = createPatientSchema.parse(request.body);
      const patient = await patientService.create(request.tenantId, data);
      auditLog('CREATE', 'PATIENT')(request, reply, { id: patient.id });
      return reply.status(201).send({ success: true, data: patient });
    }
  );

  fastify.get(
    '/patients/:patientId',
    { preHandler: [requirePermission('patient:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { patientId } = request.params as { patientId: string };
      const patient = await patientService.getById(request.tenantId, patientId, request.user.id, request.user.role);
      return reply.send({ success: true, data: patient });
    }
  );

  fastify.patch(
    '/patients/:patientId',
    { preHandler: [requirePermission('patient:update')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { patientId } = request.params as { patientId: string };
      const data = updatePatientSchema.parse(request.body);
      const patient = await patientService.update(request.tenantId, patientId, data, request.user.id, request.user.role);
      auditLog('UPDATE', 'PATIENT')(request, reply, { id: patientId });
      return reply.send({ success: true, data: patient });
    }
  );

  fastify.delete(
    '/patients/:patientId',
    { preHandler: [requirePermission('patient:delete')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { patientId } = request.params as { patientId: string };
      await patientService.softDelete(request.tenantId, patientId, request.user.id, request.user.role);
      auditLog('DELETE', 'PATIENT')(request, reply, { id: patientId });
      return reply.send({ success: true, data: { message: 'Patient deactivated' } });
    }
  );

  fastify.get(
    '/patients/:patientId/appointments',
    { preHandler: [requirePermission('appointment:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { patientId } = request.params as { patientId: string };
      const appointments = await patientService.getAppointments(request.tenantId, patientId, request.user.id, request.user.role);
      return reply.send({ success: true, data: appointments });
    }
  );

  fastify.get(
    '/patients/:patientId/soap-notes',
    { preHandler: [requirePermission('soap_note:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { patientId } = request.params as { patientId: string };
      const notes = await patientService.getSoapNotes(request.tenantId, patientId, request.user.id, request.user.role);
      return reply.send({ success: true, data: notes });
    }
  );

  fastify.get(
    '/patients/:patientId/invoices',
    { preHandler: [requirePermission('finance:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { patientId } = request.params as { patientId: string };
      const invoices = await patientService.getInvoices(request.tenantId, patientId, request.user.id, request.user.role);
      return reply.send({ success: true, data: invoices });
    }
  );

  fastify.get(
    '/patients/:patientId/exercise-plans',
    { preHandler: [requirePermission('patient:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { patientId } = request.params as { patientId: string };
      const plans = await patientService.getExercisePlans(request.tenantId, patientId, request.user.id, request.user.role);
      return reply.send({ success: true, data: plans });
    }
  );

  fastify.get(
    '/patients/:patientId/outcome-measures',
    { preHandler: [requirePermission('patient:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { patientId } = request.params as { patientId: string };
      const measures = await patientService.getOutcomeMeasures(request.tenantId, patientId, request.user.id, request.user.role);
      return reply.send({ success: true, data: measures });
    }
  );

  fastify.post(
    '/patients/:patientId/outcome-measures',
    { preHandler: [requirePermission('patient:update')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { patientId } = request.params as { patientId: string };
      const data = createOutcomeMeasureSchema.parse(request.body);
      const measure = await outcomeMeasureService.create(request.tenantId, patientId, data);
      auditLog('CREATE', 'OUTCOME_MEASURE')(request, reply, { id: measure.id, after: data });
      return reply.status(201).send({ success: true, data: measure });
    }
  );

  fastify.get(
    '/patients/:patientId/timeline',
    { preHandler: [requirePermission('patient:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { patientId } = request.params as { patientId: string };
      const timeline = await patientService.getTimeline(request.tenantId, patientId, request.user.id, request.user.role);
      return reply.send({ success: true, data: timeline });
    }
  );

  fastify.get(
    '/patients/:patientId/history',
    { preHandler: [requirePermission('patient:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { patientId } = request.params as { patientId: string };
      const history = await patientService.getHistory(request.tenantId, patientId, request.user.id, request.user.role);
      return reply.send({ success: true, data: history });
    }
  );
}
