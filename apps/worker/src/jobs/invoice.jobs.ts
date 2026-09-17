import { Worker, Job } from 'bullmq';
import { prisma } from '@physiocore/db';
import { redisConnection } from '../redis';

const worker = new Worker('invoices', async (job: Job) => {
  switch (job.name) {
    case 'send-invoice-email':
      await handleSendInvoiceEmail(job);
      break;
    case 'flag-overdue-invoices':
      await handleFlagOverdueInvoices(job);
      break;
    default:
      throw new Error(`Unknown invoice job: ${job.name}`);
  }
}, { connection: redisConnection });

async function handleSendInvoiceEmail(job: Job) {
  const { invoiceId, tenantId, patientId } = job.data;
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, tenantId },
    include: { patient: true, tenant: true },
  });
  if (!invoice || invoice.patientId !== patientId) throw new Error('Invoice recipient could not be verified');

  if (!invoice.patient.email) {
    await recordInvoiceEmailResult(tenantId, patientId, 'FAILED');
    throw new Error('Patient does not have an email address');
  }

  const channel = await prisma.notificationChannel.findFirst({
    where: { tenantId, type: 'RESEND_EMAIL', isActive: true },
  });
  const apiKey = channel?.apiKey || process.env.RESEND_API_KEY;
  const from = channel?.from || process.env.EMAIL_FROM || 'noreply@physiocore.com';
  if (!apiKey || apiKey === 'your_resend_api_key') {
    await recordInvoiceEmailResult(tenantId, patientId, 'FAILED');
    throw new Error('Resend email provider is not configured');
  }

  const lineItems = Array.isArray(invoice.lineItems) ? invoice.lineItems as Array<Record<string, unknown>> : [];
  const itemRows = lineItems.map((item) => `<tr><td>${escapeHtml(String(item.description || 'Service'))}</td><td>${Number(item.qty || 0)}</td><td>R ${Number(item.total || 0).toFixed(2)}</td></tr>`).join('');
  const html = `<p>Hello ${escapeHtml(invoice.patient.firstName)},</p><p>Your invoice <strong>${escapeHtml(invoice.invoiceNumber)}</strong> from ${escapeHtml(invoice.tenant.name)} is ready.</p><table><thead><tr><th>Description</th><th>Qty</th><th>Total</th></tr></thead><tbody>${itemRows}</tbody></table><p><strong>Total: R ${Number(invoice.total).toFixed(2)}</strong></p>`;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [invoice.patient.email],
        subject: `Invoice ${invoice.invoiceNumber}`,
        html,
      }),
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 200);
      throw new Error(`Resend rejected invoice email (${response.status})${detail ? `: ${detail}` : ''}`);
    }
    await recordInvoiceEmailResult(tenantId, patientId, 'SENT');
  } catch (error) {
    await recordInvoiceEmailResult(tenantId, patientId, 'FAILED');
    throw error;
  }
}

async function recordInvoiceEmailResult(tenantId: string, patientId: string, status: 'SENT' | 'FAILED') {
  await prisma.reminderLog.create({
    data: { tenantId, patientId, channel: 'EMAIL', status, sentAt: new Date() },
  });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] || character);
}

async function handleFlagOverdueInvoices(_job: Job) {
  const now = new Date();

  const overdueInvoices = await prisma.invoice.findMany({
    where: {
      dueDate: { lt: now },
      status: 'UNPAID',
    },
  });

  for (const invoice of overdueInvoices) {
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: 'OVERDUE' },
    });

    console.log(`[INVOICE] Flagged invoice ${invoice.invoiceNumber} as OVERDUE`);
  }
}

export default worker;
