import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  exportReportSchema,
  dateRangeSchema,
  reportDashboardQuerySchema,
  reportQuerySchema,
} from '@physiocore/schema';
import * as reportService from '../services/report.service';
import { requirePermission } from '../middleware/permissions';
import { prisma } from '@physiocore/db';
import { AppError, NotFoundError } from '../utils/errors';
import { reportQueue } from '../queues/report.queue';

function defaultReportRange() {
  const now = new Date();
  return {
    startDate: new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString(),
    endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString(),
  };
}

export default async function reportRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/reports',
    { preHandler: [requirePermission('finance:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = reportDashboardQuerySchema.parse(request.query);
      const fallback = defaultReportRange();
      const range = {
        startDate: query.startDate || fallback.startDate,
        endDate: query.endDate || fallback.endDate,
      };

      const [clinical, financial, operational, monthlyTrend, paymentReport] = await Promise.all([
        reportService.getClinical(request.tenantId, range),
        reportService.getFinancial(request.tenantId, range),
        reportService.getOperational(request.tenantId, range),
        reportService.getMonthlyTrend(request.tenantId, range),
        reportService.getPaymentReport(request.tenantId, range),
      ]);

      const outcomeData = clinical.outcomeTrend;
      const revenueData = monthlyTrend;

      const operationalData = [
        {
          metric: 'Current',
          utilisation: Math.max(0, 100 - operational.noShowRate - operational.cancellationRate),
          noShows: operational.noShows,
        },
      ];

      return reply.send({
        success: true,
        data: {
          outcomeData,
          revenueData,
          operationalData,
          collectionRate: paymentReport.summary.collectionRate,
          avgDaysToPay: paymentReport.summary.averageDaysToPay,
          outstandingBalance: financial.outstanding,
          avgUtilisation: `${Math.max(0, 100 - operational.noShowRate - operational.cancellationRate)}%`,
          noShowRate: `${operational.noShowRate}%`,
          avgSessions: `${operational.averageSessionsPerPatient}`,
        },
      });
    }
  );

  fastify.get(
    '/reports/patients',
    { preHandler: [requirePermission('finance:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = reportQuerySchema.parse(request.query);
      const data = await reportService.getPatientReport(request.tenantId, query, {
        paymentMethod: query.paymentMethod,
        memberStatus: query.memberStatus,
      });
      return reply.send({ success: true, data });
    }
  );

  fastify.get(
    '/reports/members',
    { preHandler: [requirePermission('finance:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = reportQuerySchema.parse(request.query);
      const data = await reportService.getPatientReport(request.tenantId, query, {
        paymentMethod: query.paymentMethod,
        memberStatus: query.memberStatus,
      });
      return reply.send({ success: true, data });
    }
  );

  fastify.get(
    '/reports/payments',
    { preHandler: [requirePermission('finance:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = reportQuerySchema.parse(request.query);
      const data = await reportService.getPaymentReport(request.tenantId, query, {
        paymentMethod: query.paymentMethod,
        status: query.status,
      });
      return reply.send({ success: true, data });
    }
  );

  fastify.get(
    '/reports/dashboard',
    { preHandler: [requirePermission('finance:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const data = await reportService.getDashboard(request.tenantId);
      return reply.send({ success: true, data });
    }
  );

  fastify.get(
    '/reports/clinical',
    { preHandler: [requirePermission('finance:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const dateRange = dateRangeSchema.parse(request.query);
      const data = await reportService.getClinical(request.tenantId, dateRange);
      return reply.send({ success: true, data });
    }
  );

  fastify.get(
    '/reports/financial',
    { preHandler: [requirePermission('finance:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const dateRange = dateRangeSchema.parse(request.query);
      const data = await reportService.getFinancial(request.tenantId, dateRange);
      return reply.send({ success: true, data });
    }
  );

  fastify.get(
    '/reports/operational',
    { preHandler: [requirePermission('finance:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const dateRange = dateRangeSchema.parse(request.query);
      const data = await reportService.getOperational(request.tenantId, dateRange);
      return reply.send({ success: true, data });
    }
  );

  fastify.get(
    '/reports/therapist/:therapistId',
    { preHandler: [requirePermission('finance:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { therapistId } = request.params as { therapistId: string };
      const dateRange = dateRangeSchema.parse(request.query);
      const data = await reportService.getTherapistPerformance(request.tenantId, therapistId, dateRange);
      return reply.send({ success: true, data });
    }
  );

  fastify.get(
    '/finance/summary',
    { preHandler: [requirePermission('finance:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const data = await reportService.getFinanceSummary(request.tenantId);
      return reply.send({ success: true, data });
    }
  );

  fastify.get(
    '/finance/monthly-trend',
    { preHandler: [requirePermission('finance:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const data = await reportService.getMonthlyTrend(request.tenantId);
      return reply.send({ success: true, data });
    }
  );

  fastify.post(
    '/reports/export',
    { preHandler: [requirePermission('finance:export')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const data = exportReportSchema.parse(request.body);
      const exportRecord = await prisma.reportExport.create({
        data: {
          tenantId: request.tenantId,
          requestedBy: request.user.id,
          type: data.type,
          format: data.format,
          startDate: new Date(data.dateRange.startDate),
          endDate: new Date(data.dateRange.endDate),
        },
        select: {
          id: true,
          type: true,
          format: true,
          status: true,
          createdAt: true,
        },
      });

      try {
        await reportQueue.add('export-report', {
          exportId: exportRecord.id,
          tenantId: request.tenantId,
          requestedBy: request.user.id,
          type: data.type,
          format: data.format,
          therapistId: data.therapistId,
          dateRange: data.dateRange,
        }, {
          jobId: exportRecord.id,
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: true,
          removeOnFail: false,
        });
      } catch (error) {
        await prisma.reportExport.update({
          where: { id: exportRecord.id },
          data: { status: 'FAILED', error: 'Unable to queue report export' },
        });
        request.log.error({ error, exportId: exportRecord.id }, 'Report export queue failed');
        throw new AppError(503, 'QUEUE_UNAVAILABLE', 'Report exports are temporarily unavailable');
      }

      return reply.status(202).send({ success: true, data: exportRecord });
    }
  );

  fastify.get(
    '/reports/exports/:exportId',
    { preHandler: [requirePermission('finance:read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { exportId } = request.params as { exportId: string };
      const exportRecord = await prisma.reportExport.findFirst({
        where: { id: exportId, tenantId: request.tenantId },
        select: {
          id: true,
          type: true,
          format: true,
          status: true,
          fileName: true,
          mimeType: true,
          error: true,
          createdAt: true,
          completedAt: true,
        },
      });
      if (!exportRecord) throw new NotFoundError('Report export not found');
      return reply.send({ success: true, data: exportRecord });
    }
  );

  fastify.get(
    '/reports/exports/:exportId/download',
    { preHandler: [requirePermission('finance:export')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { exportId } = request.params as { exportId: string };
      const exportRecord = await prisma.reportExport.findFirst({
        where: { id: exportId, tenantId: request.tenantId },
        select: { fileData: true, fileName: true, mimeType: true, status: true },
      });
      if (!exportRecord) throw new NotFoundError('Report export not found');
      if (exportRecord.status !== 'COMPLETED' || !exportRecord.fileData) {
        throw new AppError(409, 'EXPORT_NOT_READY', 'Report export is not ready for download');
      }

      return reply
        .header('Content-Type', exportRecord.mimeType || 'application/octet-stream')
        .header('Content-Disposition', `attachment; filename="${exportRecord.fileName || 'report-export'}"`)
        .send(exportRecord.fileData);
    }
  );
}
