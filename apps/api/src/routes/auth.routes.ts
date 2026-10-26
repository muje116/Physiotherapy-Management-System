import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  registerTenantSchema,
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '@physiocore/schema';
import * as authService from '../services/auth.service';
import { UnauthorizedError } from '../utils/errors';

const refreshCookieName = 'physiocore_refresh_token';

function setRefreshCookie(reply: FastifyReply, token: string) {
  reply.setCookie(refreshCookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/v1/auth',
    maxAge: 7 * 24 * 60 * 60,
  });
}

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/auth/register-tenant', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const data = registerTenantSchema.parse(request.body);
    const result = await authService.registerTenant(data);
    setRefreshCookie(reply, result.refreshToken);
    return reply.status(201).send({ success: true, data: result });
  });

  fastify.post('/auth/login', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const data = loginSchema.parse(request.body);
    const result = await authService.login(data.email, data.password, data.tenantSlug);
    setRefreshCookie(reply, result.refreshToken);
    return reply.send({ success: true, data: result });
  });

  fastify.post('/auth/refresh', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const data = refreshTokenSchema.parse(request.body || {});
    const rawToken = request.cookies?.[refreshCookieName] || data.refreshToken;
    if (!rawToken) throw new UnauthorizedError('Missing refresh token');
    const result = await authService.refreshToken(rawToken);
    setRefreshCookie(reply, result.refreshToken);
    return reply.send({ success: true, data: result });
  });

  fastify.post('/auth/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    const data = refreshTokenSchema.parse(request.body || {});
    const rawToken = request.cookies?.[refreshCookieName] || data.refreshToken;
    if (rawToken) await authService.logout(rawToken);
    reply.clearCookie(refreshCookieName, { path: '/api/v1/auth' });
    return reply.send({ success: true, data: null });
  });

  fastify.post('/auth/forgot-password', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const data = forgotPasswordSchema.parse(request.body);
    await authService.forgotPassword(data.email);
    return reply.send({ success: true, data: { message: 'If the email exists, a reset link has been sent' } });
  });

  fastify.post('/auth/reset-password', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
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
