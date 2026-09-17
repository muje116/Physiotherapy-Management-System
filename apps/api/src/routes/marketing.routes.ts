import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createCampaignSchema, updateCampaignSchema } from '@physiocore/schema';
import * as marketingService from '../services/marketing.service';
import { requirePermission } from '../middleware/permissions';
import { auditLog } from '../middleware/audit';

export default async function marketingRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/marketing/campaigns',
    { preHandler: [requirePermission('settings:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const campaigns = await marketingService.listCampaigns(request.tenantId);
      return reply.send({ success: true, data: campaigns });
    }
  );

  fastify.post(
    '/marketing/campaigns',
    { preHandler: [requirePermission('settings:update')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const data = createCampaignSchema.parse(request.body);
      const campaign = await marketingService.createCampaign(request.tenantId, data);
      auditLog('CREATE', 'CAMPAIGN')(request, reply, { id: campaign.id, after: data });
      return reply.status(201).send({ success: true, data: campaign });
    }
  );

  fastify.get(
    '/marketing/campaigns/:campaignId',
    { preHandler: [requirePermission('settings:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { campaignId } = request.params as { campaignId: string };
      const campaign = await marketingService.getCampaign(request.tenantId, campaignId);
      return reply.send({ success: true, data: campaign });
    }
  );

  fastify.patch(
    '/marketing/campaigns/:campaignId',
    { preHandler: [requirePermission('settings:update')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { campaignId } = request.params as { campaignId: string };
      const data = updateCampaignSchema.parse(request.body);
      const campaign = await marketingService.updateCampaign(request.tenantId, campaignId, data);
      auditLog('UPDATE', 'CAMPAIGN')(request, reply, { id: campaignId, after: data });
      return reply.send({ success: true, data: campaign });
    }
  );

  fastify.post(
    '/marketing/campaigns/:campaignId/send',
    { preHandler: [requirePermission('settings:update')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { campaignId } = request.params as { campaignId: string };
      const campaign = await marketingService.sendCampaign(request.tenantId, campaignId);
      auditLog('SEND', 'CAMPAIGN')(request, reply, { id: campaignId });
      return reply.send({ success: true, data: campaign });
    }
  );

  fastify.get(
    '/marketing/referrals',
    { preHandler: [requirePermission('settings:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const sources = await marketingService.getSources(request.tenantId);
      const referrals = sources.map((source) => ({
        name: source.source,
        value: source.count,
      }));
      return reply.send({ success: true, data: referrals });
    }
  );

  fastify.get(
    '/marketing/sources',
    { preHandler: [requirePermission('settings:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const sources = await marketingService.getSources(request.tenantId);
      return reply.send({ success: true, data: sources });
    }
  );

  fastify.get(
    '/marketing/reviews',
    { preHandler: [requirePermission('settings:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const reviews = await marketingService.getReviews(request.tenantId);
      return reply.send({ success: true, data: reviews });
    }
  );
}
