import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createInvoiceSchema, markInvoicePaidSchema, updateInvoiceClaimStatusSchema, updateInvoiceSchema, invoiceQuerySchema } from '@physiocore/schema';
import * as invoiceService from '../services/invoice.service';
import { requirePermission } from '../middleware/permissions';
import { auditLog } from '../middleware/audit';
import { generateInvoicePdf } from '../services/integrations/pdf.service';

export default async function invoiceRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/invoices',
    { preHandler: [requirePermission('finance:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = invoiceQuerySchema.parse(request.query);
      const result = await invoiceService.list(request.tenantId, query);
      return reply.send({ success: true, data: result.items, meta: { page: result.page, total: result.total } });
    }
  );

  fastify.post(
    '/invoices',
    { preHandler: [requirePermission('finance:create')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const data = createInvoiceSchema.parse(request.body);
      const invoice = await invoiceService.create(request.tenantId, data);
      auditLog('CREATE', 'INVOICE')(request, reply, { id: invoice.id, after: data });
      return reply.status(201).send({ success: true, data: invoice });
    }
  );

  fastify.get(
    '/invoices/:invoiceId',
    { preHandler: [requirePermission('finance:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { invoiceId } = request.params as { invoiceId: string };
      const invoice = await invoiceService.getById(request.tenantId, invoiceId);
      return reply.send({ success: true, data: invoice });
    }
  );

  fastify.patch(
    '/invoices/:invoiceId',
    { preHandler: [requirePermission('finance:update')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { invoiceId } = request.params as { invoiceId: string };
      const data = updateInvoiceSchema.parse(request.body);
      const invoice = await invoiceService.update(request.tenantId, invoiceId, data);
      auditLog('UPDATE', 'INVOICE')(request, reply, { id: invoiceId, after: data });
      return reply.send({ success: true, data: invoice });
    }
  );

  fastify.post(
    '/invoices/:invoiceId/send',
    { preHandler: [requirePermission('finance:update')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { invoiceId } = request.params as { invoiceId: string };
      const invoice = await invoiceService.send(request.tenantId, invoiceId);
      auditLog('SEND', 'INVOICE')(request, reply, { id: invoiceId });
      return reply.send({ success: true, data: { message: 'Invoice queued for sending' } });
    }
  );

  fastify.post(
    '/invoices/:invoiceId/mark-paid',
    { preHandler: [requirePermission('finance:update')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { invoiceId } = request.params as { invoiceId: string };
      const { paymentMethod } = markInvoicePaidSchema.parse(request.body ?? {});
      const invoice = await invoiceService.markPaid(request.tenantId, invoiceId, paymentMethod);
      auditLog('MARK_PAID', 'INVOICE')(request, reply, { id: invoiceId });
      return reply.send({ success: true, data: invoice });
    }
  );

  fastify.post(
    '/invoices/:invoiceId/submit-medical-aid',
    { preHandler: [requirePermission('finance:update')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { invoiceId } = request.params as { invoiceId: string };
      const invoice = await invoiceService.submitToMedicalAid(request.tenantId, invoiceId);
      auditLog('SUBMIT_MEDICAL_AID', 'INVOICE')(request, reply, { id: invoiceId });
      return reply.send({ success: true, data: invoice });
    }
  );

  fastify.get(
    '/invoices/:invoiceId/pdf',
    { preHandler: [requirePermission('finance:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { invoiceId } = request.params as { invoiceId: string };
      const invoice = await invoiceService.generatePdf(request.tenantId, invoiceId);
      const lineItems = Array.isArray(invoice.lineItems) ? invoice.lineItems as Array<Record<string, unknown>> : [];
      const pdf = await generateInvoicePdf({
        invoiceNumber: invoice.invoiceNumber,
        patientName: `${invoice.patient.firstName} ${invoice.patient.lastName}`,
        date: invoice.createdAt.toISOString().split('T')[0],
        lineItems: lineItems.map((item) => ({
          description: String(item.description || 'Service'),
          qty: Number(item.qty || 0),
          unitPrice: Number(item.unitPrice || 0),
          total: Number(item.total || 0),
        })),
        subtotal: Number(invoice.subtotal),
        vatAmount: Number(invoice.vatAmount),
        total: Number(invoice.total),
        clinicName: invoice.tenant.name,
        clinicVat: invoice.tenant.vatNumber || '',
        clinicPracticeNo: invoice.tenant.practiceNumber || '',
      });
      const fileName = invoice.invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
      return reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="${fileName}.pdf"`)
        .send(pdf);
    }
  );

  fastify.get(
    '/medical-aid/claims',
    { preHandler: [requirePermission('finance:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = invoiceQuerySchema.parse(request.query);
      const result = await invoiceService.getMedicalAidClaims(request.tenantId, query);
      return reply.send({ success: true, data: result.items, meta: { page: result.page, total: result.total } });
    }
  );

  fastify.patch(
    '/medical-aid/claims/:claimId',
    { preHandler: [requirePermission('finance:update')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { claimId } = request.params as { claimId: string };
      const { status } = updateInvoiceClaimStatusSchema.parse(request.body);
      const invoice = await invoiceService.updateClaimStatus(request.tenantId, claimId, status);
      auditLog('UPDATE_CLAIM_STATUS', 'INVOICE')(request, reply, { id: claimId });
      return reply.send({ success: true, data: invoice });
    }
  );

  fastify.post(
    '/medical-aid/claims/:claimId/resubmit',
    { preHandler: [requirePermission('finance:update')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { claimId } = request.params as { claimId: string };
      const invoice = await invoiceService.resubmitClaim(request.tenantId, claimId);
      auditLog('RESUBMIT_CLAIM', 'INVOICE')(request, reply, { id: claimId });
      return reply.send({ success: true, data: invoice });
    }
  );
}
