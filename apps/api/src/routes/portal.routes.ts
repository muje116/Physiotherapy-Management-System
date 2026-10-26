import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as portalService from '../services/portal.service';
import { ForbiddenError } from '../utils/errors';
import { Role } from '@physiocore/db';
import { submitFeedbackSchema } from '@physiocore/schema';

async function ensurePatientRole(request: FastifyRequest) {
  if (request.user.role !== Role.PATIENT) {
    throw new ForbiddenError('Patient portal access only');
  }
}

export default async function portalRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    await ensurePatientRole(request);
  });

  fastify.get('/portal/dashboard', async (request: FastifyRequest, reply: FastifyReply) => {
    const profile = await portalService.getProfile(request.user.id);
    const [appointments, invoices, plans, notes, paymentRequests] = await Promise.all([
      portalService.getAppointments(profile.id),
      portalService.getInvoices(profile.id),
      portalService.getExercisePlans(profile.id),
      portalService.getSoapNotes(profile.id),
      portalService.getPaymentRequests(profile.tenantId, profile.id),
    ]);

    return reply.send({
      success: true,
      data: {
        patient: {
          firstName: profile.firstName,
          lastName: profile.lastName,
        },
        upcomingAppointments: appointments.map((appointment: any) => ({
          id: appointment.id,
          date: appointment.startAt.toISOString().split('T')[0],
          time: appointment.startAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          therapist: appointment.therapist?.user
            ? `${appointment.therapist.user.firstName} ${appointment.therapist.user.lastName}`
            : 'Unassigned',
          type: appointment.type,
          status: appointment.status,
        })),
        invoices: invoices.map((invoice: any) => ({
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          date: invoice.createdAt.toISOString().split('T')[0],
          amount: `R ${Number(invoice.total).toLocaleString()}`,
          status: invoice.status,
        })),
        paymentRequests,
        exercisePlans: plans.map((plan: any) => ({
          id: plan.id,
          name: plan.name,
          exercises: plan.items.length,
          therapist: 'Assigned therapist',
        })),
        soapNotes: notes.map((note: any) => ({
          id: note.id,
          date: note.createdAt.toISOString().split('T')[0],
          therapist: note.therapistId,
          summary: note.assessment,
        })),
      },
    });
  });

  fastify.get('/portal/me', async (request: FastifyRequest, reply: FastifyReply) => {
    const profile = await portalService.getProfile(request.user.id);
    return reply.send({ success: true, data: profile });
  });

  fastify.get('/portal/appointments', async (request: FastifyRequest, reply: FastifyReply) => {
    const profile = await portalService.getProfile(request.user.id);
    const appointments = await portalService.getAppointments(profile.id);
    return reply.send({ success: true, data: appointments });
  });

  fastify.post('/portal/appointments/:appointmentId/cancel', async (request: FastifyRequest, reply: FastifyReply) => {
    const { appointmentId } = request.params as { appointmentId: string };
    const profile = await portalService.getProfile(request.user.id);
    const appointment = await portalService.cancelAppointment(profile.id, appointmentId);
    return reply.send({ success: true, data: appointment });
  });

  fastify.get('/portal/invoices', async (request: FastifyRequest, reply: FastifyReply) => {
    const profile = await portalService.getProfile(request.user.id);
    const invoices = await portalService.getInvoices(profile.id);
    return reply.send({ success: true, data: invoices });
  });

  fastify.get('/portal/payment-requests', async (request: FastifyRequest, reply: FastifyReply) => {
    const profile = await portalService.getProfile(request.user.id);
    const paymentRequests = await portalService.getPaymentRequests(profile.tenantId, profile.id);
    return reply.send({ success: true, data: paymentRequests });
  });

  fastify.get('/portal/exercise-plans', async (request: FastifyRequest, reply: FastifyReply) => {
    const profile = await portalService.getProfile(request.user.id);
    const plans = await portalService.getExercisePlans(profile.id);
    return reply.send({ success: true, data: plans });
  });

  fastify.get('/portal/soap-notes', async (request: FastifyRequest, reply: FastifyReply) => {
    const profile = await portalService.getProfile(request.user.id);
    const notes = await portalService.getSoapNotes(profile.id);
    return reply.send({ success: true, data: notes });
  });

  fastify.post('/portal/feedback', async (request: FastifyRequest, reply: FastifyReply) => {
    const profile = await portalService.getProfile(request.user.id);
    const data = submitFeedbackSchema.parse(request.body);
    const feedback = await portalService.submitFeedback(profile.tenantId, profile.id, data);
    return reply.status(201).send({ success: true, data: feedback });
  });

  fastify.post('/portal/invoices/:invoiceId/pay', async (request: FastifyRequest, reply: FastifyReply) => {
    const { invoiceId } = request.params as { invoiceId: string };
    const profile = await portalService.getProfile(request.user.id);
    const result = await portalService.payInvoice(profile.tenantId, profile.id, invoiceId, request.user.id);
    return reply.send({ success: true, data: result });
  });
}
