import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as medicalSchemeService from '../services/medical-scheme.service';
import { requirePermission } from '../middleware/permissions';
import { auditLog } from '../middleware/audit';
import {
  createMedicalSchemeClaimSchema,
  createMedicalSchemeSchema,
  medicalSchemeClaimQuerySchema,
  updateMedicalSchemeClaimStatusSchema,
  updateMedicalSchemeSchema,
} from '@physiocore/schema';

export default async function medicalSchemeRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/medical-schemes',
    { preHandler: [requirePermission('scheme:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const schemes = await medicalSchemeService.listSchemes(request.tenantId);
      return reply.send({ success: true, data: schemes });
    }
  );

  fastify.post(
    '/medical-schemes',
    { preHandler: [requirePermission('scheme:write')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const data = createMedicalSchemeSchema.parse(request.body);
      const scheme = await medicalSchemeService.createScheme(request.tenantId, data);
      auditLog('CREATE', 'MEDICAL_SCHEME')(request, reply, { id: scheme.id, after: data });
      return reply.status(201).send({ success: true, data: scheme });
    }
  );

  fastify.patch(
    '/medical-schemes/:id',
    { preHandler: [requirePermission('scheme:write')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const data = updateMedicalSchemeSchema.parse(request.body);
      const scheme = await medicalSchemeService.updateScheme(request.tenantId, id, data);
      auditLog('UPDATE', 'MEDICAL_SCHEME')(request, reply, { id, after: data });
      return reply.send({ success: true, data: scheme });
    }
  );

  fastify.delete(
    '/medical-schemes/:id',
    { preHandler: [requirePermission('scheme:write')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      await medicalSchemeService.deleteScheme(request.tenantId, id);
      auditLog('DELETE', 'MEDICAL_SCHEME')(request, reply, { id });
      return reply.send({ success: true, message: 'Medical scheme deleted' });
    }
  );

  fastify.get(
    '/medical-schemes/claims',
    { preHandler: [requirePermission('scheme:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = medicalSchemeClaimQuerySchema.parse(request.query);
      const result = await medicalSchemeService.listClaims(request.tenantId, query);
      return reply.send({ success: true, data: result.items, meta: { page: result.page, total: result.total, limit: result.limit } });
    }
  );

  fastify.post(
    '/medical-schemes/claims',
    { preHandler: [requirePermission('scheme:write')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const data = createMedicalSchemeClaimSchema.parse(request.body);
      const claim = await medicalSchemeService.createClaim(request.tenantId, data);
      auditLog('CREATE', 'SCHEME_CLAIM')(request, reply, { id: claim.id, after: data });
      return reply.status(201).send({ success: true, data: claim });
    }
  );

  fastify.post(
    '/medical-schemes/claims/:id/submit',
    { preHandler: [requirePermission('scheme:write')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const claim = await medicalSchemeService.submitClaim(request.tenantId, id);
      auditLog('SUBMIT', 'SCHEME_CLAIM')(request, reply, { id });
      return reply.send({ success: true, data: claim });
    }
  );

  fastify.patch(
    '/medical-schemes/claims/:id/status',
    { preHandler: [requirePermission('scheme:write')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const { status, rejectionReason } = updateMedicalSchemeClaimStatusSchema.parse(request.body);
      const claim = await medicalSchemeService.updateClaimStatus(request.tenantId, id, status, rejectionReason);
      auditLog('UPDATE_CLAIM_STATUS', 'SCHEME_CLAIM')(request, reply, { id, after: { status, rejectionReason } });
      return reply.send({ success: true, data: claim });
    }
  );

  fastify.get(
    '/medical-schemes/claims/report',
    { preHandler: [requirePermission('scheme:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as { startDate?: string; endDate?: string };
      const report = await medicalSchemeService.getClaimsReport(request.tenantId, query.startDate, query.endDate);
      return reply.send({ success: true, data: report });
    }
  );
}
