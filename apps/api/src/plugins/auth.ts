import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { prisma } from '@physiocore/db';
import { JwtPayload, AuthenticatedUser } from '../types';
import { UnauthorizedError } from '../utils/errors';

const PUBLIC_ROUTES = [
  'GET /',
  'GET /live',
  'GET /ready',
  'GET /health',
  'POST /api/v1/auth/register-tenant',
  'POST /api/v1/auth/login',
  'POST /api/v1/auth/refresh',
  'POST /api/v1/auth/logout',
  'POST /api/v1/auth/forgot-password',
  'POST /api/v1/auth/reset-password',
  'POST /api/v1/payments/onekhusa/webhook',
  'GET /docs',
];

function isPublicRoute(method: string, url: string): boolean {
  const routeKey = `${method} ${url.split('?')[0]}`;
  if (PUBLIC_ROUTES.includes(routeKey)) return true;
  if (url.startsWith('/docs/') && method === 'GET') return true;
  return false;
}

export function setupAuth(fastify: FastifyInstance) {
  fastify.decorateRequest('user', null as unknown as AuthenticatedUser);
  fastify.decorateRequest('tenantId', '');

  fastify.addHook('onRequest', async (request: FastifyRequest, _reply: FastifyReply) => {
    if (isPublicRoute(request.method, request.url)) return;

    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid authorization header');
    }

    const token = authHeader.substring(7);
    let payload: JwtPayload;
    try {
      const secret = process.env.JWT_ACCESS_SECRET;
      if (!secret) throw new Error('JWT_ACCESS_SECRET is not configured');
      payload = jwt.verify(token, secret) as JwtPayload;
    } catch {
      throw new UnauthorizedError('Invalid or expired token');
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { tenant: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedError('User not found or inactive');
    }

    request.user = {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
    };
    request.tenantId = user.tenantId;
  });
}

export default async function authPlugin(fastify: FastifyInstance) {
  setupAuth(fastify);
}
