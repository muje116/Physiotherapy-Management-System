import { z } from 'zod';

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  employeeNumber: z.string().trim().max(50).optional(),
  jobTitle: z.string().trim().max(100).optional(),
  department: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(50).optional(),
  hireDate: z.string().datetime().optional(),
  role: z.enum(['ADMIN', 'FRONT_DESK', 'THERAPIST', 'BILLING']),
});

export const updateUserSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  employeeNumber: z.string().trim().max(50).optional().nullable(),
  jobTitle: z.string().trim().max(100).optional().nullable(),
  department: z.string().trim().max(100).optional().nullable(),
  phone: z.string().trim().max(50).optional().nullable(),
  hireDate: z.string().datetime().optional().nullable(),
  role: z.enum(['ADMIN', 'FRONT_DESK', 'THERAPIST', 'BILLING']).optional(),
  isActive: z.boolean().optional(),
});

export const resetUserPasswordSchema = z.object({
  newPassword: z.string().min(8).max(100),
});

export const userQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'FRONT_DESK', 'THERAPIST', 'BILLING']).optional(),
  search: z.string().optional(),
  department: z.string().trim().optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ResetUserPasswordInput = z.infer<typeof resetUserPasswordSchema>;
