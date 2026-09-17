import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  createPaymentMethodSchema,
  paymentQuerySchema,
  recordPaymentSchema,
  updatePaymentMethodSchema,
} from '@physiocore/schema';
import * as paymentMethodService from '../services/payment-method.service';
import * as paymentService from '../services/payment.service';
import { requirePermission } from '../middleware/permissions';
import { auditLog } from '../middleware/audit';

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
}
