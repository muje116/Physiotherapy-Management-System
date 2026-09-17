import { prisma } from '@physiocore/db';
import { NotFoundError } from '../utils/errors';
import { renderTemplate, sendNotification } from './notification.service';

export async function listCampaigns(tenantId: string) {
  return prisma.marketingCampaign.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createCampaign(tenantId: string, data: { name: string; channel: string[]; template: string; scheduledAt?: string }) {
  return prisma.marketingCampaign.create({
    data: {
      tenantId,
      name: data.name,
      channel: data.channel,
      template: data.template,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
    },
  });
}

export async function getCampaign(tenantId: string, campaignId: string) {
  const campaign = await prisma.marketingCampaign.findFirst({
    where: { id: campaignId, tenantId },
  });
  if (!campaign) throw new NotFoundError('Campaign not found');
  return campaign;
}

export async function updateCampaign(tenantId: string, campaignId: string, data: any) {
  const campaign = await prisma.marketingCampaign.findFirst({
    where: { id: campaignId, tenantId },
  });
  if (!campaign) throw new NotFoundError('Campaign not found');

  return prisma.marketingCampaign.update({
    where: { id: campaignId },
    data,
  });
}

export async function sendCampaign(tenantId: string, campaignId: string) {
  const campaign = await prisma.marketingCampaign.findFirst({
    where: { id: campaignId, tenantId },
  });
  if (!campaign) throw new NotFoundError('Campaign not found');

  const patients = await prisma.patient.findMany({
    where: { tenantId, isActive: true },
    select: { id: true, firstName: true, email: true, phone: true },
  });
  const channels = campaign.channel.filter((channel): channel is 'EMAIL' | 'SMS' | 'WHATSAPP' =>
    channel === 'EMAIL' || channel === 'SMS' || channel === 'WHATSAPP',
  );
  let delivered = 0;

  for (const patient of patients) {
    for (const channel of channels) {
      const to = channel === 'EMAIL' ? patient.email : patient.phone;
      if (!to) continue;

      const body = renderTemplate(campaign.template, { patientName: patient.firstName });
      const sent = await sendNotification({
        to,
        subject: campaign.name,
        body,
        channel,
        tenantId,
        patientId: patient.id,
      });
      if (sent) delivered++;
    }
  }

  return prisma.marketingCampaign.update({
    where: { id: campaignId },
    data: {
      status: delivered > 0 ? 'ACTIVE' : 'PAUSED',
      sentAt: delivered > 0 ? new Date() : null,
      sentCount: { increment: delivered },
    },
  });
}

export async function getSources(tenantId: string) {
  const patients = await prisma.patient.findMany({
    where: { tenantId, referralSource: { not: null } },
    select: { referralSource: true },
  });

  const breakdown: Record<string, number> = {};
  patients.forEach((p) => {
    const source = p.referralSource || 'Unknown';
    breakdown[source] = (breakdown[source] || 0) + 1;
  });

  const total = patients.length;

  return Object.entries(breakdown).map(([source, count]) => ({
    source,
    count,
    percentage: total > 0 ? Math.round((count / total) * 100) : 0,
  }));
}

export async function getReviews(tenantId: string) {
  const [summary, ratings, recent] = await Promise.all([
    prisma.patientFeedback.aggregate({
      where: { tenantId },
      _avg: { rating: true },
      _count: { id: true },
    }),
    prisma.patientFeedback.groupBy({
      by: ['rating'],
      where: { tenantId },
      _count: { id: true },
    }),
    prisma.patientFeedback.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { patient: { select: { firstName: true, lastName: true } } },
    }),
  ]);

  const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  ratings.forEach((rating) => {
    if (rating.rating >= 1 && rating.rating <= 5) distribution[rating.rating as 1 | 2 | 3 | 4 | 5] = rating._count.id;
  });

  return {
    averageRating: summary._avg.rating ? Number(summary._avg.rating.toFixed(1)) : 0,
    totalReviews: summary._count.id,
    distribution,
    recent: recent.map((review) => ({
      id: review.id,
      patientName: `${review.patient.firstName} ${review.patient.lastName}`,
      rating: review.rating,
      comment: review.comment || '',
      createdAt: review.createdAt.toISOString(),
    })),
  };
}
