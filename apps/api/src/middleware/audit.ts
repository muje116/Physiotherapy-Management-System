import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@physiocore/db';

type PendingAudit = {
  action: string;
  resourceType: string;
  payload?: any;
};

function redactSensitive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSensitive);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, nested]) => {
    if (/password|token|secret|apikey|authorization/i.test(key)) return [key, '[REDACTED]'];
    return [key, redactSensitive(nested)];
  }));
}

export const auditLog = (action: string, resourceType: string) => {
  return (request: FastifyRequest, _reply: FastifyReply, payload: any) => {
    const requestWithAudits = request as FastifyRequest & { pendingAuditLogs?: PendingAudit[] };
    requestWithAudits.pendingAuditLogs ||= [];
    requestWithAudits.pendingAuditLogs.push({ action, resourceType, payload });
  };
};

export async function onResponseAuditHook(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user?.id || !request.tenantId) return;

  const requestWithAudits = request as FastifyRequest & { pendingAuditLogs?: PendingAudit[] };
  const entries = requestWithAudits.pendingAuditLogs || [];
  if (['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    entries.push({
      action: `${request.method}_${request.routeOptions.url || request.url.split('?')[0]}`,
      resourceType: request.method === 'GET' ? 'HTTP_READ' : 'HTTP',
    });
  }

  if (entries.length === 0) return;

  try {
    await prisma.auditLog.createMany({
      data: entries.map(({ action, resourceType, payload }) => ({
        tenantId: request.tenantId,
        userId: request.user.id,
        action,
        resourceType,
        resourceId: payload?.id || undefined,
        before: redactSensitive(payload?.before) as any,
        after: redactSensitive(payload?.after) as any,
        ip: request.ip,
        userAgent: request.headers['user-agent'] || null,
      })),
    });
  } catch (err) {
    request.log.error({ err, statusCode: reply.statusCode }, 'Audit log hook failed');
  }
}
