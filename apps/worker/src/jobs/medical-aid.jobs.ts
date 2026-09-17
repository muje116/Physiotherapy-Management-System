import { Worker, Job } from 'bullmq';
import { prisma, Prisma } from '@physiocore/db';
import { redisConnection } from '../redis';

const worker = new Worker('medical-aid', async (job: Job) => {
  switch (job.name) {
    case 'poll-claim-status':
      await handlePollClaimStatus(job);
      break;
    default:
      throw new Error(`Unknown medical-aid job: ${job.name}`);
  }
}, { connection: redisConnection });

async function handlePollClaimStatus(_job: Job) {
  const pendingInvoices = await prisma.invoice.findMany({
    where: {
      status: 'SUBMITTED_TO_MEDICAL_AID',
      medicalAidClaim: { not: Prisma.JsonNull },
    },
  });

  if (pendingInvoices.length > 0) {
    console.warn(
      `[MEDICAL-AID] ${pendingInvoices.length} claim(s) remain pending. ` +
      'No external medical-aid status adapter is configured; staff must record the funder response manually.',
    );
  }
}

export default worker;
