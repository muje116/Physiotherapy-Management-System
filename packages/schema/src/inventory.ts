import { z } from 'zod';
import { recordIdSchema, paginationSchema } from './common';

const queryBoolean = z.preprocess((value) => {
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return value;
}, z.boolean());

export const assetStatusSchema = z.enum(['IN_SERVICE', 'MAINTENANCE', 'RETIRED', 'LOST']);

export const assetQuerySchema = paginationSchema.extend({
  search: z.string().trim().optional(),
  status: assetStatusSchema.optional(),
  category: z.string().trim().optional(),
});

export const createAssetSchema = z.object({
  assetTag: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(100),
  description: z.string().trim().max(2000).optional(),
  serialNumber: z.string().trim().max(150).optional(),
  location: z.string().trim().max(200).optional(),
  status: assetStatusSchema.default('IN_SERVICE'),
  condition: z.string().trim().min(1).max(50).default('GOOD'),
  purchaseDate: z.string().datetime().optional(),
  purchaseCost: z.coerce.number().min(0).optional(),
  warrantyExpiresAt: z.string().datetime().optional(),
  assignedToUserId: recordIdSchema.optional().nullable(),
});

export const updateAssetSchema = createAssetSchema.partial();

export const drugQuerySchema = paginationSchema.extend({
  search: z.string().trim().optional(),
  lowStockOnly: queryBoolean.default(false),
  activeOnly: queryBoolean.default(true),
});

export const createDrugInventorySchema = z.object({
  name: z.string().trim().min(1).max(200),
  genericName: z.string().trim().max(200).optional(),
  strength: z.string().trim().max(100).optional(),
  dosageForm: z.string().trim().max(100).optional(),
  unit: z.string().trim().min(1).max(50).default('unit'),
  batchNumber: z.string().trim().max(100).optional(),
  expiryDate: z.string().datetime().optional(),
  supplier: z.string().trim().max(200).optional(),
  storageLocation: z.string().trim().max(200).optional(),
  initialQuantity: z.coerce.number().int().min(0).default(0),
  reorderLevel: z.coerce.number().int().min(0).default(0),
  unitCost: z.coerce.number().min(0).optional(),
});

export const updateDrugInventorySchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  genericName: z.string().trim().max(200).optional().nullable(),
  strength: z.string().trim().max(100).optional().nullable(),
  dosageForm: z.string().trim().max(100).optional().nullable(),
  unit: z.string().trim().min(1).max(50).optional(),
  batchNumber: z.string().trim().max(100).optional(),
  expiryDate: z.string().datetime().optional().nullable(),
  supplier: z.string().trim().max(200).optional().nullable(),
  storageLocation: z.string().trim().max(200).optional().nullable(),
  reorderLevel: z.coerce.number().int().min(0).optional(),
  unitCost: z.coerce.number().min(0).optional().nullable(),
  isActive: z.boolean().optional(),
});

export const receiveDrugStockSchema = z.object({
  quantity: z.coerce.number().int().positive(),
  reference: z.string().trim().max(150).optional(),
  reason: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const issueDrugSchema = z.object({
  quantity: z.coerce.number().int().positive(),
  patientId: recordIdSchema.optional(),
  recipientUserId: recordIdSchema.optional(),
  reason: z.string().trim().max(500).optional(),
  reference: z.string().trim().max(150).optional(),
  notes: z.string().trim().max(1000).optional(),
}).refine((value) => Boolean(value.patientId) !== Boolean(value.recipientUserId), {
  message: 'Select exactly one patient or employee recipient',
  path: ['patientId'],
});

export const adjustDrugStockSchema = z.object({
  quantityDelta: z.coerce.number().int().refine((value) => value !== 0, 'Quantity adjustment cannot be zero'),
  reason: z.string().trim().min(1).max(500),
  reference: z.string().trim().max(150).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const inventoryMovementQuerySchema = paginationSchema;

export type AssetQuery = z.infer<typeof assetQuerySchema>;
export type CreateAssetInput = z.infer<typeof createAssetSchema>;
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>;
export type DrugQuery = z.infer<typeof drugQuerySchema>;
export type CreateDrugInventoryInput = z.infer<typeof createDrugInventorySchema>;
export type UpdateDrugInventoryInput = z.infer<typeof updateDrugInventorySchema>;
export type ReceiveDrugStockInput = z.infer<typeof receiveDrugStockSchema>;
export type IssueDrugInput = z.infer<typeof issueDrugSchema>;
export type AdjustDrugStockInput = z.infer<typeof adjustDrugStockSchema>;
