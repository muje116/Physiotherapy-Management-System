import Fastify, { FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { z } from 'zod';
import { Prisma, prisma } from '@physiocore/db';
import { AppError } from './utils/errors';
import { onResponseAuditHook } from './middleware/audit';
import { setupAuth } from './plugins/auth';
import { setupTenant } from './plugins/tenant';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import patientRoutes from './routes/patient.routes';
import appointmentRoutes from './routes/appointment.routes';
import therapistRoutes from './routes/therapist.routes';
import soapNoteRoutes from './routes/soap-note.routes';
import invoiceRoutes from './routes/invoice.routes';
import exercisePlanRoutes from './routes/exercise-plan.routes';
import reminderRoutes from './routes/reminder.routes';
import marketingRoutes from './routes/marketing.routes';
import reportRoutes from './routes/report.routes';
import settingsRoutes from './routes/settings.routes';
import portalRoutes from './routes/portal.routes';
import notificationRoutes from './routes/notification.routes';
import paymentRoutes from './routes/payment.routes';
import medicalSchemeRoutes from './routes/medical-scheme.routes';
import treatmentPlanRoutes from './routes/treatment-plan.routes';
import clientTaskRoutes from './routes/client-task.routes';
import outcomeMeasureRoutes from './routes/outcome-measure.routes';
import inventoryRoutes from './routes/inventory.routes';
import clinicalObservationRoutes from './routes/clinical-observation.routes';
import { setupRequestId } from './middleware/request-id';
import { setupErrorTracking } from './middleware/error-tracker';
import { setupPerformanceMonitoring } from './middleware/performance';
import { validateEnv } from './utils/env-validator';

const PORT = parseInt(process.env.PORT || '4000', 10);
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

async function buildApp() {
  validateEnv();

  const app = Fastify({
    trustProxy: process.env.TRUST_PROXY === 'true',
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
    },
  });

  // Preserve the exact JSON bytes so OneKhusa HMAC signatures can be verified
  // before the webhook payload is parsed and reconciled.
  app.decorateRequest('rawBody', null);
  app.removeContentTypeParser('application/json');
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (request, body, done) => {
    const rawBody = typeof body === 'string' ? body : body.toString('utf8');
    request.rawBody = rawBody;
    try {
      done(null, JSON.parse(rawBody));
    } catch (error) {
      done(error as Error);
    }
  });

  await app.register(cors, {
    origin: FRONTEND_URL.split(',').map((origin) => origin.trim()),
    credentials: true,
  });

  await app.register(cookie);

  await app.register(rateLimit, {
    max: 500,
    timeWindow: '1 minute',
    keyGenerator: (request: FastifyRequest) => {
      return request.ip;
    },
  });

  if (process.env.NODE_ENV !== 'production') {
    await app.register(swagger, {
      openapi: {
        info: {
          title: 'PhysioCore API',
          description: 'Physiotherapy practice management API',
          version: '1.0.0',
        },
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
            },
          },
        },
      },
    });

    await app.register(swaggerUi, {
      routePrefix: '/docs',
    });
  }

  setupAuth(app);
  setupTenant(app);
  setupRequestId(app);
  setupErrorTracking(app);
  setupPerformanceMonitoring(app);

  app.addHook('onResponse', onResponseAuditHook);

  app.get('/', async () => ({
    name: 'PhysioCore API',
    status: 'ok',
    health: '/health',
    docs: process.env.NODE_ENV === 'production' ? null : '/docs',
    api: '/api/v1',
  }));

  app.setErrorHandler((error, request, reply) => {
    if (error.name === 'ZodError') {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: (error as any).errors,
        },
      });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return reply.status(409).send({ success: false, error: { code: 'CONFLICT', message: 'Resource already exists' } });
      }
      if (error.code === 'P2025') {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Resource not found' } });
      }
      if (error.code === 'P2004') {
        return reply.status(409).send({ success: false, error: { code: 'CONFLICT', message: 'The requested change conflicts with existing data' } });
      }
    }

    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: (error as any).details || undefined,
        },
      });
    }

    if (error.statusCode === 429) {
      return reply.status(429).send({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests, please try again later',
        },
      });
    }

    request.log.error(error);

    const statusCode = (error as any).statusCode || 500;
    return reply.status(statusCode).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: statusCode === 500 ? 'Internal server error' : error.message,
      },
    });
  });

  await app.register(authRoutes, { prefix: '/api/v1' });
  await app.register(userRoutes, { prefix: '/api/v1' });
  await app.register(patientRoutes, { prefix: '/api/v1' });
  await app.register(appointmentRoutes, { prefix: '/api/v1' });
  await app.register(therapistRoutes, { prefix: '/api/v1' });
  await app.register(soapNoteRoutes, { prefix: '/api/v1' });
  await app.register(invoiceRoutes, { prefix: '/api/v1' });
  await app.register(exercisePlanRoutes, { prefix: '/api/v1' });
  await app.register(reminderRoutes, { prefix: '/api/v1' });
  await app.register(marketingRoutes, { prefix: '/api/v1' });
  await app.register(reportRoutes, { prefix: '/api/v1' });
  await app.register(settingsRoutes, { prefix: '/api/v1' });
  await app.register(portalRoutes, { prefix: '/api/v1' });
  await app.register(notificationRoutes, { prefix: '/api/v1' });
  await app.register(paymentRoutes, { prefix: '/api/v1' });
  await app.register(medicalSchemeRoutes, { prefix: '/api/v1' });
  await app.register(treatmentPlanRoutes, { prefix: '/api/v1' });
  await app.register(clientTaskRoutes, { prefix: '/api/v1' });
  await app.register(outcomeMeasureRoutes, { prefix: '/api/v1' });
  await app.register(inventoryRoutes, { prefix: '/api/v1' });
  await app.register(clinicalObservationRoutes, { prefix: '/api/v1' });

  return app;
}

async function start() {
  const app = await buildApp();

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'Shutting down API');
    try {
      await app.close();
      await prisma.$disconnect();
    } finally {
      process.exit(0);
    }
  };
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));

  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    app.log.info(`PhysioCore API running on port ${PORT}`);
    if (process.env.NODE_ENV !== 'production') {
      app.log.info(`Documentation available at http://localhost:${PORT}/docs`);
    }
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  start();
}

export { buildApp };
