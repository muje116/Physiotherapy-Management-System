import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  createPaymentMethodSchema,
  paymentQuerySchema,
  recordPaymentSchema,
  updatePaymentMethodSchema,
  createPaymentRequestSchema,
  paymentRequestQuerySchema,
} from '@physiocore/schema';
import * as paymentMethodService from '../services/payment-method.service';
import * as paymentService from '../services/payment.service';
import { requirePermission } from '../middleware/permissions';
import { auditLog } from '../middleware/audit';
import * as paymentRequestService from '../services/payment-request.service';

export default async function paymentRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/payments/methods',
    { preHandler: [requirePermission('payment:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const methods = await paymentMethodService.listMethods(request.tenantId);
      return reply.send({ success: true, data: methods });
    }
  );

  fastify.post(
    '/payments/methods',
    { preHandler: [requirePermission('payment:create')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const data = createPaymentMethodSchema.parse(request.body);
      const method = await paymentMethodService.createMethod(request.tenantId, data);
      auditLog('CREATE', 'PAYMENT_METHOD')(request, reply, { id: method.id, after: data });
      return reply.status(201).send({ success: true, data: method });
    }
  );

  fastify.patch(
    '/payments/methods/:id',
    { preHandler: [requirePermission('payment:create')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const data = updatePaymentMethodSchema.parse(request.body);
      const method = await paymentMethodService.updateMethod(request.tenantId, id, data);
      auditLog('UPDATE', 'PAYMENT_METHOD')(request, reply, { id, after: data });
      return reply.send({ success: true, data: method });
    }
  );

  fastify.delete(
    '/payments/methods/:id',
    { preHandler: [requirePermission('payment:create')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      await paymentMethodService.deleteMethod(request.tenantId, id);
      auditLog('DELETE', 'PAYMENT_METHOD')(request, reply, { id });
      return reply.send({ success: true, message: 'Payment method deleted' });
    }
  );

  fastify.get(
    '/payments',
    { preHandler: [requirePermission('payment:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = paymentQuerySchema.parse(request.query);
      const result = await paymentService.listPayments(request.tenantId, query);
      return reply.send({ success: true, data: result.items, meta: { page: result.page, total: result.total, limit: result.limit } });
    }
  );

  fastify.post(
    '/payments',
    { preHandler: [requirePermission('payment:create')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const data = recordPaymentSchema.parse(request.body);
      const payment = await paymentService.recordPayment(request.tenantId, data);
      auditLog('CREATE', 'PAYMENT')(request, reply, { id: payment.id, after: data });
      return reply.status(201).send({ success: true, data: payment });
    }
  );

  fastify.get(
    '/payments/summary',
    { preHandler: [requirePermission('payment:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const summary = await paymentService.getPaymentSummary(request.tenantId);
      return reply.send({ success: true, data: summary });
    }
  );

  fastify.get(
    '/payments/requests',
    { preHandler: [requirePermission('payment:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = paymentRequestQuerySchema.parse(request.query);
      const result = await paymentRequestService.listPaymentRequests(request.tenantId, query);
      return reply.send({ success: true, data: result.items, meta: { page: result.page, total: result.total, limit: result.limit } });
    }
  );

  fastify.post(
    '/payments/requests',
    { preHandler: [requirePermission('payment:create')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const data = createPaymentRequestSchema.parse(request.body);
      const paymentRequest = await paymentRequestService.createPaymentRequest(request.tenantId, request.user.id, data);
      auditLog('CREATE', 'PAYMENT_REQUEST')(request, reply, { id: paymentRequest.id, after: data });
      return reply.status(201).send({ success: true, data: paymentRequest });
    }
  );

  fastify.get(
    '/payments/requests/:id',
    { preHandler: [requirePermission('payment:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const paymentRequest = await paymentRequestService.getPaymentRequest(request.tenantId, id);
      return reply.send({ success: true, data: paymentRequest });
    }
  );

  fastify.post(
    '/payments/requests/:id/poll',
    { preHandler: [requirePermission('payment:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const paymentRequest = await paymentRequestService.pollPaymentRequest(request.tenantId, id);
      return reply.send({ success: true, data: paymentRequest });
    }
  );

  fastify.post(
    '/payments/onekhusa/webhook',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const event = request.headers['x-onekhusa-webhook-event'];
      const signature = request.headers['x-onekhusa-webhook-signature'];
      const result = await paymentRequestService.handleWebhook(
        typeof event === 'string' ? event : undefined,
        request.rawBody || '',
        typeof signature === 'string' ? signature : undefined,
      );
      // OneKhusa retries non-200 webhook responses. The handler verifies and
      // reconciles the event before acknowledging it with a successful status.
      return reply.status(200).send({ success: true, data: result });
    }
  );
}
