import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@physiocore/db';

function redactSensitive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSensitive);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, nested]) => {
    if (/password|token|secret|apikey|authorization/i.test(key)) return [key, '[REDACTED]'];
    return [key, redactSensitive(nested)];
  }));
}

export const auditLog = (action: string, resourceType: string) => {
  return async (request: FastifyRequest, _reply: FastifyReply, payload: any) => {
    await prisma.auditLog.create({
      data: {
        tenantId: request.tenantId,
        userId: request.user.id,
        action,
        resourceType,
        resourceId: payload?.id || undefined,
        before: redactSensitive(payload?.before) as any,
        after: redactSensitive(payload?.after) as any,
        ip: request.ip,
        userAgent: request.headers['user-agent'] || null,
      },
    });
  };
};

export async function onResponseAuditHook(request: FastifyRequest, reply: FastifyReply) {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) && request.user?.id) {
    try {
      await prisma.auditLog.create({
        data: {
          tenantId: request.tenantId || '',
          userId: request.user.id,
          action: `${request.method}_${request.url}`,
          resourceType: 'HTTP',
          resourceId: undefined,
          before: undefined,
          after: undefined,
          ip: request.ip,
          userAgent: request.headers['user-agent'] || null,
        },
      });
    } catch (err) {
      request.log.error({ err }, 'Audit log hook failed');
    }
  }
}
