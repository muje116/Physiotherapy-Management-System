import { FastifyInstance } from 'fastify';
import { AppError } from '../utils/errors';

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

  app.get('/health', async () => ({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    memory: process.memoryUsage(),
  }));

  return { getRateLimitViolations: () => rateLimitViolations };
}
