import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { availableSlotsQuerySchema, cancelAppointmentSchema, createAppointmentSchema, updateAppointmentSchema, appointmentQuerySchema } from '@physiocore/schema';
import * as appointmentService from '../services/appointment.service';
import { requirePermission } from '../middleware/permissions';
import { auditLog } from '../middleware/audit';

export default async function appointmentRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/appointments',
    { preHandler: [requirePermission('appointment:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = appointmentQuerySchema.parse(request.query);
      const result = await appointmentService.list(request.tenantId, query);
      return reply.send({ success: true, data: result.items, meta: { page: result.page, total: result.total } });
    }
  );

  fastify.post(
    '/appointments',
    { preHandler: [requirePermission('appointment:create')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const data = createAppointmentSchema.parse(request.body);
      const appointment = await appointmentService.create(request.tenantId, data);
      auditLog('CREATE', 'APPOINTMENT')(request, reply, { id: appointment.id, after: data });
      return reply.status(201).send({ success: true, data: appointment });
    }
  );

  fastify.get(
    '/appointments/available-slots',
    { preHandler: [requirePermission('appointment:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = availableSlotsQuerySchema.parse(request.query);
      const slots = await appointmentService.getAvailableSlots(request.tenantId, query.therapistId, query.date);
      return reply.send({ success: true, data: slots });
    }
  );

  fastify.get(
    '/appointments/:appointmentId',
    { preHandler: [requirePermission('appointment:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { appointmentId } = request.params as { appointmentId: string };
      const appointment = await appointmentService.getById(request.tenantId, appointmentId);
      return reply.send({ success: true, data: appointment });
    }
  );

  fastify.patch(
    '/appointments/:appointmentId',
    { preHandler: [requirePermission('appointment:update')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { appointmentId } = request.params as { appointmentId: string };
      const data = updateAppointmentSchema.parse(request.body);
      const appointment = await appointmentService.update(request.tenantId, appointmentId, data);
      auditLog('UPDATE', 'APPOINTMENT')(request, reply, { id: appointmentId, after: data });
      return reply.send({ success: true, data: appointment });
    }
  );

  fastify.post(
    '/appointments/:appointmentId/cancel',
    { preHandler: [requirePermission('appointment:update')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { appointmentId } = request.params as { appointmentId: string };
      const { reason } = cancelAppointmentSchema.parse(request.body ?? {});
      const appointment = await appointmentService.cancel(request.tenantId, appointmentId, reason);
      auditLog('CANCEL', 'APPOINTMENT')(request, reply, { id: appointmentId });
      return reply.send({ success: true, data: appointment });
    }
  );

  fastify.post(
    '/appointments/:appointmentId/confirm',
    { preHandler: [requirePermission('appointment:update')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { appointmentId } = request.params as { appointmentId: string };
      const appointment = await appointmentService.confirm(request.tenantId, appointmentId);
      return reply.send({ success: true, data: appointment });
    }
  );

  fastify.post(
    '/appointments/:appointmentId/no-show',
    { preHandler: [requirePermission('appointment:update')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { appointmentId } = request.params as { appointmentId: string };
      const appointment = await appointmentService.markNoShow(request.tenantId, appointmentId);
      return reply.send({ success: true, data: appointment });
    }
  );

  fastify.delete(
    '/appointments/:appointmentId',
    { preHandler: [requirePermission('appointment:delete')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { appointmentId } = request.params as { appointmentId: string };
      await appointmentService.cancel(request.tenantId, appointmentId, 'Deleted by user');
      return reply.send({ success: true, data: { message: 'Appointment deleted' } });
    }
  );
}
