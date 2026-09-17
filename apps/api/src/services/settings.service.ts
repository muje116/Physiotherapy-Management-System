import { prisma } from '@physiocore/db';
import { NotFoundError } from '../utils/errors';

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
