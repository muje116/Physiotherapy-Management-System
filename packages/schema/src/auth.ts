import { z } from 'zod';

export const registerTenantSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8).max(100),
  adminFirstName: z.string().min(1).max(50),
  adminLastName: z.string().min(1).max(50),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  tenantSlug: z.string().optional(),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().uuid(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().uuid(),
  password: z.string().min(8).max(100),
});

export type RegisterTenantInput = z.infer<typeof registerTenantSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
