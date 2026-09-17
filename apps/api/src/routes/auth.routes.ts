import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  registerTenantSchema,
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '@physiocore/schema';
import * as authService from '../services/auth.service';

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/auth/register-tenant', {
    config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const data = registerTenantSchema.parse(request.body);
    const result = await authService.registerTenant(data);
    return reply.status(201).send({ success: true, data: result });
  });

  fastify.post('/auth/login', {
    config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const data = loginSchema.parse(request.body);
    const result = await authService.login(data.email, data.password, data.tenantSlug);
    return reply.send({ success: true, data: result });
  });

  fastify.post('/auth/refresh', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const data = refreshTokenSchema.parse(request.body);
    const result = await authService.refreshToken(data.refreshToken);
    return reply.send({ success: true, data: result });
  });

  fastify.post('/auth/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    const data = refreshTokenSchema.parse(request.body);
    await authService.logout(data.refreshToken);
    return reply.send({ success: true, data: null });
  });

  fastify.post('/auth/forgot-password', {
    config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const data = forgotPasswordSchema.parse(request.body);
    await authService.forgotPassword(data.email);
    return reply.send({ success: true, data: { message: 'If the email exists, a reset link has been sent' } });
  });

  fastify.post('/auth/reset-password', {
    config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const data = resetPasswordSchema.parse(request.body);
    await authService.resetPassword(data.token, data.password);
    return reply.send({ success: true, data: { message: 'Password has been reset successfully' } });
  });

  fastify.get('/auth/me', async (request: FastifyRequest, reply: FastifyReply) => {
    const result = await authService.getMe(request.user.id);
    return reply.send({ success: true, data: result });
  });
}
