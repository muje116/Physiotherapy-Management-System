import { prisma } from '@physiocore/db';
import { AppError, NotFoundError } from '../utils/errors';
import { sendEmail } from './integrations/email.service';

export async function getTenant(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });
  if (!tenant) throw new NotFoundError('Tenant not found');
  return tenant;
}

export async function updateTenant(tenantId: string, data: { name?: string; practiceNumber?: string; vatNumber?: string; timezone?: string; currency?: string; logoUrl?: string }) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new NotFoundError('Tenant not found');

  return prisma.tenant.update({
    where: { id: tenantId },
    data,
  });
}

export async function getSettings(tenantId: string) {
  const settings = await prisma.tenantSettings.findUnique({
    where: { tenantId },
  });
  if (!settings) throw new NotFoundError('Settings not found');
  return settings;
}

export async function updateSettings(tenantId: string, data: {
  appointmentDuration?: number;
  workingHoursStart?: string;
  workingHoursEnd?: string;
  workingDays?: number[];
  defaultReminderRules?: boolean;
  portalEnabled?: boolean;
  telehealthEnabled?: boolean;
}) {
  const settings = await prisma.tenantSettings.findUnique({ where: { tenantId } });
  if (!settings) throw new NotFoundError('Settings not found');

  return prisma.tenantSettings.update({
    where: { tenantId },
    data,
  });
}

export async function getIntegrations(tenantId: string) {
  const settings = await prisma.tenantSettings.findUnique({
    where: { tenantId },
    select: {
      smsProvider: true,
      emailProvider: true,
      medicalAidSwitch: true,
      xeroIntegration: true,
    },
  });

  if (!settings) throw new NotFoundError('Settings not found');

  return {
    sms: { enabled: !!settings.smsProvider, provider: settings.smsProvider },
    email: { enabled: !!settings.emailProvider, provider: settings.emailProvider },
    medicalAid: { enabled: settings.medicalAidSwitch },
    xero: { enabled: settings.xeroIntegration },
  };
}

export async function updateIntegration(tenantId: string, key: string, data: { enabled: boolean; apiKey?: string; apiSecret?: string }) {
  const settings = await prisma.tenantSettings.findUnique({ where: { tenantId } });
  if (!settings) throw new NotFoundError('Settings not found');

  const updateData: any = {};
  switch (key) {
    case 'sms':
      updateData.smsProvider = data.enabled ? (data.apiKey ? 'custom' : null) : null;
      break;
    case 'email':
      updateData.emailProvider = data.enabled ? (data.apiKey ? 'custom' : null) : null;
      await prisma.notificationChannel.updateMany({
        where: { tenantId, type: 'RESEND_EMAIL' },
        data: { isActive: data.enabled },
      });
      break;
    case 'medicalAid':
      updateData.medicalAidSwitch = data.enabled;
      break;
    case 'xero':
      updateData.xeroIntegration = data.enabled;
      break;
    default:
      throw new NotFoundError(`Unknown integration key: ${key}`);
  }

  return prisma.tenantSettings.update({
    where: { tenantId },
    data: updateData,
    select: {
      smsProvider: true,
      emailProvider: true,
      medicalAidSwitch: true,
      xeroIntegration: true,
    },
  });
}

export async function getEmailSettings(tenantId: string) {
  const channel = await prisma.notificationChannel.findFirst({
    where: { tenantId, type: 'RESEND_EMAIL' },
    select: { id: true, from: true, isActive: true, apiKey: true },
  });
  return {
    from: channel?.from || process.env.EMAIL_FROM || '',
    enabled: channel?.isActive ?? false,
    hasApiKey: Boolean(channel?.apiKey || process.env.RESEND_API_KEY),
  };
}

export async function updateEmailSettings(tenantId: string, data: { apiKey?: string; from: string; enabled: boolean }) {
  const existing = await prisma.notificationChannel.findFirst({ where: { tenantId, type: 'RESEND_EMAIL' } });
  const channelData = {
    from: data.from || null,
    isActive: data.enabled,
    ...(data.apiKey?.trim() ? { apiKey: data.apiKey.trim() } : {}),
  };

  if (existing) {
    await prisma.notificationChannel.update({ where: { id: existing.id }, data: channelData });
  } else {
    await prisma.notificationChannel.create({
      data: { tenantId, type: 'RESEND_EMAIL', ...channelData, apiKey: data.apiKey?.trim() || null },
    });
  }

  await prisma.tenantSettings.updateMany({ where: { tenantId }, data: { emailProvider: data.enabled ? 'RESEND' : null } });
  return getEmailSettings(tenantId);
}

export async function sendEmailTest(tenantId: string, to: string) {
  const channel = await prisma.notificationChannel.findFirst({ where: { tenantId, type: 'RESEND_EMAIL', isActive: true } });
  const apiKey = channel?.apiKey || process.env.RESEND_API_KEY;
  if (!apiKey || apiKey === 'your_resend_api_key') {
    throw new AppError(503, 'EMAIL_NOT_CONFIGURED', 'Add a Resend API key and enable email delivery before sending a test message.');
  }

  const delivered = await sendEmail({
    to,
    subject: 'Test email from your physiotherapy clinic',
    body: '<p>Your clinic email settings are working.</p>',
    from: channel?.from || process.env.EMAIL_FROM,
  }, { apiKey });

  if (!delivered) throw new AppError(503, 'EMAIL_DELIVERY_FAILED', 'Resend could not deliver the test email. Check the sender address and API key.');
  return { delivered: true };
}
