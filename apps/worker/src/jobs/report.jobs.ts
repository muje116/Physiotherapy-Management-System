import { Worker, Job } from 'bullmq';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { prisma } from '@physiocore/db';
import { redisConnection } from '../redis';

type ReportRow = Record<string, string | number>;

const worker = new Worker('reports', async (job: Job) => {
  try {
    switch (job.name) {
      case 'export-report':
        await handleExportReport(job);
        break;
      default:
        throw new Error(`Unknown report job: ${job.name}`);
    }
  } catch (err) {
    console.error(`[REPORT] Job ${job.id} (${job.name}) failed:`, err);
    throw err;
  }
}, {
  connection: redisConnection,
});

async function handleExportReport(job: Job) {
  const {
    exportId,
    tenantId,
    type,
    format,
    therapistId,
    dateRange,
  } = job.data as {
    exportId: string;
    tenantId: string;
    type: string;
    format: 'pdf' | 'csv';
    therapistId?: string;
    dateRange?: { startDate?: string; endDate?: string; start?: string; end?: string };
  };

  const exportRecord = await prisma.reportExport.findFirst({
    where: { id: exportId, tenantId },
  });
  if (!exportRecord) throw new Error('Report export record not found');

  await prisma.reportExport.update({
    where: { id: exportId },
    data: { status: 'PROCESSING', error: null },
  });

  try {
    const startDate = new Date(dateRange?.startDate || dateRange?.start || exportRecord.startDate);
    const endDate = new Date(dateRange?.endDate || dateRange?.end || exportRecord.endDate);
    const report = await buildReport(type, tenantId, startDate, endDate, therapistId);
    const fileData = format === 'pdf'
      ? await renderPdf(report.title, report.headers, report.rows)
      : Buffer.from(toCsv(report.headers, report.rows), 'utf8');
    const extension = format === 'pdf' ? 'pdf' : 'csv';

    await prisma.reportExport.update({
      where: { id: exportId },
      data: {
        status: 'COMPLETED',
        fileName: `${type}-${exportId}.${extension}`,
        mimeType: format === 'pdf' ? 'application/pdf' : 'text/csv; charset=utf-8',
        fileData,
        error: null,
        completedAt: new Date(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Report generation failed';
    await prisma.reportExport.update({
      where: { id: exportId },
      data: { status: 'FAILED', error: message },
    });
    throw error;
  }
}

async function buildReport(type: string, tenantId: string, startDate: Date, endDate: Date, therapistId?: string) {
  switch (type) {
    case 'financial': {
      const invoices = await prisma.invoice.findMany({
        where: { tenantId, createdAt: { gte: startDate, lte: endDate } },
        include: { patient: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
      });
      return {
        title: 'Financial Report',
        headers: ['Invoice', 'Patient', 'Date', 'Total', 'Status', 'Due Date'],
        rows: invoices.map((invoice) => ({
          Invoice: invoice.invoiceNumber,
          Patient: `${invoice.patient.firstName} ${invoice.patient.lastName}`,
          Date: invoice.createdAt.toISOString().split('T')[0],
          Total: Number(invoice.total).toFixed(2),
          Status: invoice.status,
          'Due Date': invoice.dueDate?.toISOString().split('T')[0] || '',
        })),
      };
    }
    case 'clinical': {
      const appointments = await prisma.appointment.findMany({
        where: {
          tenantId,
          startAt: { gte: startDate, lte: endDate },
          ...(therapistId ? { therapistId } : {}),
        },
        include: {
          patient: { select: { firstName: true, lastName: true } },
          therapist: { include: { user: { select: { firstName: true, lastName: true } } } },
        },
        orderBy: { startAt: 'desc' },
      });
      return {
        title: 'Clinical Report',
        headers: ['Date', 'Patient', 'Therapist', 'Type', 'Status'],
        rows: appointments.map((appointment) => ({
          Date: appointment.startAt.toISOString(),
          Patient: `${appointment.patient.firstName} ${appointment.patient.lastName}`,
          Therapist: `${appointment.therapist.user.firstName} ${appointment.therapist.user.lastName}`,
          Type: appointment.type,
          Status: appointment.status,
        })),
      };
    }
    case 'operational': {
      const [newPatients, therapists, appointments] = await Promise.all([
        prisma.patient.count({ where: { tenantId, createdAt: { gte: startDate, lte: endDate } } }),
        prisma.therapist.count({ where: { tenantId, isActive: true } }),
        prisma.appointment.count({ where: { tenantId, startAt: { gte: startDate, lte: endDate } } }),
      ]);
      return {
        title: 'Operational Report',
        headers: ['Metric', 'Value'],
        rows: [
          { Metric: 'New patients', Value: newPatients },
          { Metric: 'Active therapists', Value: therapists },
          { Metric: 'Appointments', Value: appointments },
        ],
      };
    }
    case 'therapist': {
      const appointments = await prisma.appointment.findMany({
        where: {
          tenantId,
          startAt: { gte: startDate, lte: endDate },
          ...(therapistId ? { therapistId } : {}),
        },
        include: {
          patient: { select: { firstName: true, lastName: true } },
          therapist: { include: { user: { select: { firstName: true, lastName: true } } } },
        },
        orderBy: { startAt: 'desc' },
      });
      return {
        title: 'Therapist Performance Report',
        headers: ['Therapist', 'Patient', 'Date', 'Status', 'Minutes'],
        rows: appointments.map((appointment) => ({
          Therapist: `${appointment.therapist.user.firstName} ${appointment.therapist.user.lastName}`,
          Patient: `${appointment.patient.firstName} ${appointment.patient.lastName}`,
          Date: appointment.startAt.toISOString(),
          Status: appointment.status,
          Minutes: Math.max(0, Math.round((appointment.endAt.getTime() - appointment.startAt.getTime()) / 60000)),
        })),
      };
    }
    case 'patients':
    case 'members': {
      const patients = await prisma.patient.findMany({
        // A member report covers the tenant's members and measures their
        // activity in the selected period; membership creation is not a filter.
        where: { tenantId },
        include: {
          appointments: {
            where: { startAt: { gte: startDate, lte: endDate } },
            select: { status: true },
          },
          payments: {
            where: { paidAt: { gte: startDate, lte: endDate } },
            select: { amount: true, status: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      return {
        title: 'Member Report',
        headers: ['Patient Code', 'Patient', 'Status', 'Preferred Method', 'Visits', 'Collected'],
        rows: patients.map((patient) => ({
          'Patient Code': patient.patientCode,
          Patient: `${patient.firstName} ${patient.lastName}`,
          Status: patient.isActive ? 'ACTIVE' : 'INACTIVE',
          'Preferred Method': patient.paymentMethod || 'Not specified',
          Visits: patient.appointments.filter((appointment) => appointment.status === 'COMPLETED').length,
          Collected: patient.payments
            .filter((payment) => payment.status === 'COMPLETED')
            .reduce((sum, payment) => sum + Number(payment.amount), 0)
            .toFixed(2),
        })),
      };
    }
    case 'payments': {
      const payments = await prisma.payment.findMany({
        where: { tenantId, paidAt: { gte: startDate, lte: endDate } },
        include: {
          patient: { select: { firstName: true, lastName: true } },
          invoice: { select: { invoiceNumber: true } },
          paymentMethod: { select: { type: true } },
        },
        orderBy: { paidAt: 'desc' },
      });
      return {
        title: 'Payment Report',
        headers: ['Date', 'Patient', 'Invoice', 'Amount', 'Method', 'Status', 'Reference'],
        rows: payments.map((payment) => ({
          Date: payment.paidAt.toISOString(),
          Patient: `${payment.patient.firstName} ${payment.patient.lastName}`,
          Invoice: payment.invoice?.invoiceNumber || '',
          Amount: Number(payment.amount).toFixed(2),
          Method: payment.methodName || payment.paymentMethod?.type || 'OTHER',
          Status: payment.status,
          Reference: payment.reference || '',
        })),
      };
    }
    case 'medical-scheme-payments': {
      const payments = await prisma.payment.findMany({
        where: {
          tenantId,
          status: 'COMPLETED',
          paidAt: { gte: startDate, lte: endDate },
          OR: [
            { methodName: { contains: 'MEDICAL', mode: 'insensitive' } },
            { paymentMethod: { is: { type: { contains: 'MEDICAL', mode: 'insensitive' } } } },
            { invoice: { schemeClaims: { some: {} } } },
          ],
        },
        include: {
          patient: { select: { patientCode: true, firstName: true, lastName: true, medicalAidName: true, medicalAidNo: true } },
          invoice: {
            select: {
              invoiceNumber: true,
              schemeClaims: {
                include: { scheme: { select: { name: true, code: true } } },
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
            },
          },
          paymentMethod: { select: { name: true, type: true } },
        },
        orderBy: { paidAt: 'desc' },
      });
      const rows = payments.filter((payment: any) => {
        const method = `${payment.methodName || ''} ${payment.paymentMethod?.type || ''}`.toLowerCase();
        return method.includes('medical') || payment.invoice?.schemeClaims?.length;
      });
      return {
        title: 'Medical Scheme Collections Report',
        headers: ['Scheme', 'Scheme Code', 'Patient Code', 'Patient', 'Medical Aid Number', 'Invoice', 'Date', 'Amount', 'Method', 'Reference'],
        rows: rows.map((payment: any) => {
          const scheme = payment.invoice?.schemeClaims?.[0]?.scheme;
          return {
            Scheme: scheme?.name || payment.patient.medicalAidName || 'Medical scheme not linked',
            'Scheme Code': scheme?.code || '',
            'Patient Code': payment.patient.patientCode,
            Patient: `${payment.patient.firstName} ${payment.patient.lastName}`,
            'Medical Aid Number': payment.patient.medicalAidNo || '',
            Invoice: payment.invoice?.invoiceNumber || '',
            Date: payment.paidAt.toISOString(),
            Amount: Number(payment.amount).toFixed(2),
            Method: payment.paymentMethod?.name || payment.methodName || 'Medical Aid',
            Reference: payment.reference || '',
          };
        }),
      };
    }
    default:
      throw new Error(`Unsupported report type: ${type}`);
  }
}

function toCsv(headers: string[], rows: ReportRow[]) {
  const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  return [
    headers.map(escape).join(','),
    ...rows.map((row) => headers.map((header) => escape(row[header])).join(',')),
  ].join('\n');
}

async function renderPdf(title: string, headers: string[], rows: ReportRow[]) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([595.28, 841.89]);
  let y = 790;

  const drawLine = (text: string, bold = false) => {
    if (y < 45) {
      page = pdf.addPage([595.28, 841.89]);
      y = 790;
    }
    page.drawText(text.substring(0, 115), { x: 40, y, size: bold ? 16 : 8, font: bold ? boldFont : font, color: rgb(0.12, 0.16, 0.25) });
    y -= bold ? 26 : 13;
  };

  drawLine(title, true);
  drawLine(`Generated ${new Date().toISOString()}`);
  drawLine(headers.join(' | '), true);
  for (const row of rows) drawLine(headers.map((header) => String(row[header] ?? '')).join(' | '));

  return Buffer.from(await pdf.save());
}

export default worker;
