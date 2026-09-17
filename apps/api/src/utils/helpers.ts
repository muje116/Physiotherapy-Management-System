import { prisma } from '@physiocore/db';

export async function generatePatientCode(tenantId: string): Promise<string> {
  const lastPatient = await prisma.patient.findFirst({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    select: { patientCode: true },
  });

  let nextNum = 1;
  if (lastPatient?.patientCode) {
    const match = lastPatient.patientCode.match(/P-(\d+)/);
    if (match) {
      nextNum = parseInt(match[1], 10) + 1;
    }
  }

  return `P-${String(nextNum).padStart(5, '0')}`;
}

export function sanitizeInput(str: string): string {
  return str.replace(/<[^>]*>/g, '');
}

export function calculateVat(amount: number, rate = 0.15): { subtotal: number; vatAmount: number; total: number } {
  const subtotal = Math.round(amount * 100) / 100;
  const vatAmount = Math.round(subtotal * rate * 100) / 100;
  const total = Math.round((subtotal + vatAmount) * 100) / 100;
  return { subtotal, vatAmount, total };
}
