import { FastifyInstance } from 'fastify';
import { AppError } from '../utils/errors';
import { prisma } from '@physiocore/db';

export function setupErrorTracking(app: FastifyInstance) {
  let rateLimitViolations = 0;
  app.addHook('onSend', async (_request, payload) => {
    if (typeof payload === 'string') {
      try {
        const parsed = JSON.parse(payload);
        if (!parsed.success && parsed.error?.code === 'RATE_LIMIT_EXCEEDED') {
          rateLimitViolations++;
        }
      } catch {}
    }
  });

  const liveResponse = () => ({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    memory: process.memoryUsage(),
  });

  app.get('/live', async () => liveResponse());

  app.get('/ready', async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return reply.send({ status: 'ready', timestamp: new Date().toISOString() });
    } catch (error) {
      return reply.status(503).send({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        error: process.env.NODE_ENV === 'production' ? 'database_unavailable' : String(error),
      });
    }
  });

  app.get('/health', async () => liveResponse());

  return { getRateLimitViolations: () => rateLimitViolations };
}
