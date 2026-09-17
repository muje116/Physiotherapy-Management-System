import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createSoapNoteSchema, updateSoapNoteSchema, soapNoteQuerySchema } from '@physiocore/schema';
import * as soapNoteService from '../services/soap-note.service';
import { requirePermission } from '../middleware/permissions';
import { auditLog } from '../middleware/audit';

export default async function soapNoteRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/soap-notes',
    { preHandler: [requirePermission('soap_note:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = soapNoteQuerySchema.parse(request.query);
      const result = await soapNoteService.list(request.tenantId, query);
      return reply.send({ success: true, data: result.items, meta: { page: result.page, total: result.total } });
    }
  );

  fastify.post(
    '/soap-notes',
    { preHandler: [requirePermission('soap_note:create')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const data = createSoapNoteSchema.parse(request.body);
      const soapNote = await soapNoteService.create(request.tenantId, data);
      auditLog('CREATE', 'SOAP_NOTE')(request, reply, { id: soapNote.id, after: data });
      return reply.status(201).send({ success: true, data: soapNote });
    }
  );

  fastify.get(
    '/soap-notes/:soapNoteId',
    { preHandler: [requirePermission('soap_note:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { soapNoteId } = request.params as { soapNoteId: string };
      const soapNote = await soapNoteService.getById(request.tenantId, soapNoteId);
      return reply.send({ success: true, data: soapNote });
    }
  );

  fastify.patch(
    '/soap-notes/:soapNoteId',
    { preHandler: [requirePermission('soap_note:update')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { soapNoteId } = request.params as { soapNoteId: string };
      const data = updateSoapNoteSchema.parse(request.body);
      const soapNote = await soapNoteService.update(request.tenantId, soapNoteId, data);
      auditLog('UPDATE', 'SOAP_NOTE')(request, reply, { id: soapNoteId, after: data });
      return reply.send({ success: true, data: soapNote });
    }
  );

  fastify.post(
    '/soap-notes/:soapNoteId/sign',
    { preHandler: [requirePermission('soap_note:sign')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { soapNoteId } = request.params as { soapNoteId: string };
      const soapNote = await soapNoteService.sign(request.tenantId, soapNoteId, request.user.id);
      auditLog('SIGN', 'SOAP_NOTE')(request, reply, { id: soapNoteId });
      return reply.send({ success: true, data: soapNote });
    }
  );

  fastify.get(
    '/soap-notes/:soapNoteId/suggest',
    { preHandler: [requirePermission('soap_note:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { soapNoteId } = request.params as { soapNoteId: string };
      const suggestions = await soapNoteService.getSuggestions(soapNoteId);
      return reply.send({ success: true, data: suggestions });
    }
  );
}
