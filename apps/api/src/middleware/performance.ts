import { FastifyInstance } from 'fastify';

export function setupPerformanceMonitoring(app: FastifyInstance) {
  const startMap = new WeakMap<object, bigint>();

  app.addHook('onRequest', async (request, _reply) => {
    startMap.set(request, process.hrtime.bigint());
  });

  app.addHook('onResponse', async (request, reply) => {
    const start = startMap.get(request);
    if (start) {
      const duration = Number(process.hrtime.bigint() - start) / 1e6;
      if (duration > 1000) {
        app.log.warn({
          requestId: request.id,
          method: request.method,
          route: request.routeOptions.url || 'unmatched',
          statusCode: reply.statusCode,
          durationMs: Math.round(duration),
        }, 'Slow request detected');
      }
    }
  });
}

export function getMemoryUsage() {
  const usage = process.memoryUsage();
  return {
    rss: `${Math.round(usage.rss / 1024 / 1024)} MB`,
    heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)} MB`,
    heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)} MB`,
    external: `${Math.round(usage.external / 1024 / 1024)} MB`,
  };
}
