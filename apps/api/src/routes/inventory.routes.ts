import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  adjustDrugStockSchema,
  assetQuerySchema,
  createAssetSchema,
  createDrugInventorySchema,
  drugQuerySchema,
  inventoryMovementQuerySchema,
  issueDrugSchema,
  receiveDrugStockSchema,
  updateAssetSchema,
  updateDrugInventorySchema,
} from '@physiocore/schema';
import * as inventoryService from '../services/inventory.service';
import { requirePermission } from '../middleware/permissions';
import { auditLog } from '../middleware/audit';

export default async function inventoryRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/inventory/summary',
    { preHandler: [requirePermission('inventory:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const summary = await inventoryService.getInventorySummary(request.tenantId);
      return reply.send({ success: true, data: summary });
    },
  );

  fastify.get(
    '/inventory/assets',
    { preHandler: [requirePermission('inventory:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = assetQuerySchema.parse(request.query);
      const result = await inventoryService.listAssets(request.tenantId, query);
      return reply.send({ success: true, data: result.items, meta: { page: result.page, total: result.total, limit: result.limit } });
    },
  );

  fastify.post(
    '/inventory/assets',
    { preHandler: [requirePermission('inventory:write')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const data = createAssetSchema.parse(request.body);
      const asset = await inventoryService.createAsset(request.tenantId, data);
      auditLog('CREATE', 'ASSET')(request, reply, { id: asset.id, after: data });
      return reply.status(201).send({ success: true, data: asset });
    },
  );

  fastify.patch(
    '/inventory/assets/:assetId',
    { preHandler: [requirePermission('inventory:write')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { assetId } = request.params as { assetId: string };
      const data = updateAssetSchema.parse(request.body);
      const asset = await inventoryService.updateAsset(request.tenantId, assetId, data);
      auditLog('UPDATE', 'ASSET')(request, reply, { id: assetId, after: data });
      return reply.send({ success: true, data: asset });
    },
  );

  fastify.delete(
    '/inventory/assets/:assetId',
    { preHandler: [requirePermission('inventory:write')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { assetId } = request.params as { assetId: string };
      const asset = await inventoryService.retireAsset(request.tenantId, assetId);
      auditLog('RETIRE', 'ASSET')(request, reply, { id: assetId });
      return reply.send({ success: true, data: asset });
    },
  );

  fastify.get(
    '/inventory/drugs',
    { preHandler: [requirePermission('inventory:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = drugQuerySchema.parse(request.query);
      const result = await inventoryService.listDrugs(request.tenantId, query);
      return reply.send({ success: true, data: result.items, meta: { page: result.page, total: result.total, limit: result.limit } });
    },
  );

  fastify.post(
    '/inventory/drugs',
    { preHandler: [requirePermission('inventory:write')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const data = createDrugInventorySchema.parse(request.body);
      const drug = await inventoryService.createDrug(request.tenantId, request.user.id, data);
      auditLog('CREATE', 'DRUG_INVENTORY')(request, reply, { id: drug.id, after: data });
      return reply.status(201).send({ success: true, data: drug });
    },
  );

  fastify.patch(
    '/inventory/drugs/:drugId',
    { preHandler: [requirePermission('inventory:write')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { drugId } = request.params as { drugId: string };
      const data = updateDrugInventorySchema.parse(request.body);
      const drug = await inventoryService.updateDrug(request.tenantId, drugId, data);
      auditLog('UPDATE', 'DRUG_INVENTORY')(request, reply, { id: drugId, after: data });
      return reply.send({ success: true, data: drug });
    },
  );

  fastify.post(
    '/inventory/drugs/:drugId/receive',
    { preHandler: [requirePermission('inventory:write')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { drugId } = request.params as { drugId: string };
      const data = receiveDrugStockSchema.parse(request.body);
      const drug = await inventoryService.receiveDrugStock(request.tenantId, drugId, request.user.id, data);
      auditLog('RECEIVE', 'DRUG_STOCK')(request, reply, { id: drugId, after: data });
      return reply.send({ success: true, data: drug });
    },
  );

  fastify.post(
    '/inventory/drugs/:drugId/issue',
    { preHandler: [requirePermission('inventory:issue')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { drugId } = request.params as { drugId: string };
      const data = issueDrugSchema.parse(request.body);
      const movement = await inventoryService.issueDrug(request.tenantId, drugId, request.user.id, data);
      auditLog('ISSUE', 'DRUG_STOCK')(request, reply, { id: movement.id, after: data });
      return reply.status(201).send({ success: true, data: movement });
    },
  );

  fastify.post(
    '/inventory/drugs/:drugId/adjust',
    { preHandler: [requirePermission('inventory:write')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { drugId } = request.params as { drugId: string };
      const data = adjustDrugStockSchema.parse(request.body);
      const drug = await inventoryService.adjustDrugStock(request.tenantId, drugId, request.user.id, data);
      auditLog('ADJUST', 'DRUG_STOCK')(request, reply, { id: drugId, after: data });
      return reply.send({ success: true, data: drug });
    },
  );

  fastify.get(
    '/inventory/drugs/:drugId/movements',
    { preHandler: [requirePermission('inventory:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { drugId } = request.params as { drugId: string };
      const query = inventoryMovementQuerySchema.parse(request.query);
      const result = await inventoryService.listDrugMovements(request.tenantId, drugId, query);
      return reply.send({ success: true, data: result.items, meta: { page: result.page, total: result.total, limit: result.limit } });
    },
  );
}
