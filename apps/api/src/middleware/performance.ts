import { FastifyInstance } from 'fastify';

export function setupPerformanceMonitoring(app: FastifyInstance) {
  let startMap = new WeakMap();

  app.addHook('onRequest', async (request, _reply) => {
    startMap.set(request, process.hrtime.bigint());
  });

  app.addHook('onResponse', async (request, _reply) => {
    const start = startMap.get(request);
    if (start) {
      const duration = Number(process.hrtime.bigint() - start) / 1e6;
      if (duration > 1000) {
        app.log.warn({ method: request.method, url: request.url, durationMs: Math.round(duration) }, 'Slow request detected');
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
