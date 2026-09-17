import { prisma, AppointmentStatus, InvoiceStatus } from '@physiocore/db';

type ReportDateRange = { startDate: string; endDate: string };

type PatientReportOptions = {
  paymentMethod?: string;
  memberStatus?: 'ACTIVE' | 'INACTIVE';
};

type PaymentReportOptions = {
  paymentMethod?: string;
  status?: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
};

function toReportDates(dateRange: ReportDateRange) {
  return { start: new Date(dateRange.startDate), end: new Date(dateRange.endDate) };
}

function toAmount(value: unknown) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundPercent(value: number) {
  return Math.round(value * 10) / 10;
}

function methodLabel(value: string | null | undefined) {
  return value?.trim() || 'Not specified';
}

function sumAmounts<T>(items: T[], getAmount: (item: T) => unknown) {
  return roundMoney(items.reduce((sum, item) => sum + toAmount(getAmount(item)), 0));
}

export async function getDashboard(tenantId: string) {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const [
    todayAppointments,
    newPatientsThisMonth,
    revenueThisMonth,
    outstandingInvoices,
    totalAppointments,
    noShowAppointments,
  ] = await Promise.all([
    prisma.appointment.count({ where: { tenantId, startAt: { gte: todayStart, lte: todayEnd } } }),
    prisma.patient.count({ where: { tenantId, createdAt: { gte: monthStart, lte: monthEnd } } }),
    prisma.invoice.aggregate({
      where: { tenantId, status: InvoiceStatus.PAID, paidAt: { gte: monthStart, lte: monthEnd } },
      _sum: { total: true },
    }),
    prisma.invoice.count({ where: { tenantId, status: { in: [InvoiceStatus.UNPAID, InvoiceStatus.OVERDUE] } } }),
    prisma.appointment.count({ where: { tenantId, startAt: { gte: monthStart, lte: monthEnd } } }),
    prisma.appointment.count({ where: { tenantId, status: AppointmentStatus.NO_SHOW, startAt: { gte: monthStart, lte: monthEnd } } }),
  ]);

  const noShowRate = totalAppointments > 0 ? Math.round((noShowAppointments / totalAppointments) * 100) : 0;

  const settings = await prisma.tenantSettings.findUnique({ where: { tenantId } });
  const workDays = settings?.workingDays?.length || 5;
  const workStart = settings?.workingHoursStart || '08:00';
  const workEnd = settings?.workingHoursEnd || '17:00';
  const [wsH, wsM] = workStart.split(':').map(Number);
  const [weH, weM] = workEnd.split(':').map(Number);
  const dayMinutes = ((weH * 60 + weM) - (wsH * 60 + wsM)) * workDays;
  const totalAvailableMinutes = dayMinutes * 4;

  let utilisation = 0;
  if (totalAvailableMinutes > 0) {
    const appointments = await prisma.appointment.findMany({
      where: { tenantId, status: { notIn: ['CANCELLED' as any, 'NO_SHOW' as any] }, startAt: { gte: monthStart, lte: monthEnd } },
      select: { startAt: true, endAt: true },
    });
    const totalBookedMinutes = appointments.reduce((sum, a) => {
      return sum + (a.endAt.getTime() - a.startAt.getTime()) / 60000;
    }, 0);
    utilisation = Math.round((totalBookedMinutes / totalAvailableMinutes) * 100);
  }

  return {
    todayAppointments,
    newPatientsThisMonth,
    revenueThisMonth: revenueThisMonth._sum.total || 0,
    outstandingInvoices,
    noShowRate,
    utilisation,
  };
}

export async function getClinical(tenantId: string, dateRange: { startDate: string; endDate: string }) {
  const start = new Date(dateRange.startDate);
  const end = new Date(dateRange.endDate);

  const outcomeMeasures = await prisma.outcomeMeasure.findMany({
    where: { tenantId, recordedAt: { gte: start, lte: end } },
    orderBy: { recordedAt: 'asc' },
  });

  const painScores = await prisma.soapNote.findMany({
    where: { tenantId, painScore: { not: null }, createdAt: { gte: start, lte: end } },
    select: { painScore: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  const avgPainReduction = painScores.length > 0
    ? painScores.reduce((sum, s) => sum + (s.painScore || 0), 0) / painScores.length
    : 0;

  const outcomeTrendMap = outcomeMeasures.reduce((acc: Record<string, { total: number; count: number }>, outcome) => {
    const month = `${outcome.recordedAt.getFullYear()}-${String(outcome.recordedAt.getMonth() + 1).padStart(2, '0')}`;
    const monthData = acc[month] || { total: 0, count: 0 };
    monthData.total += outcome.percentage;
    monthData.count += 1;
    acc[month] = monthData;
    return acc;
  }, {});

  return {
    outcomeMeasures: {
      total: outcomeMeasures.length,
      averageScore: outcomeMeasures.length > 0
        ? outcomeMeasures.reduce((sum, o) => sum + o.percentage, 0) / outcomeMeasures.length
        : 0,
      byType: outcomeMeasures.reduce((acc: Record<string, number>, o) => {
        acc[o.type] = (acc[o.type] || 0) + 1;
        return acc;
      }, {}),
    },
    outcomeTrend: Object.entries(outcomeTrendMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, values]) => ({
        month,
        averageScore: Math.round((values.total / values.count) * 10) / 10,
        measureCount: values.count,
      })),
    painScores: {
      total: painScores.length,
      averagePainScore: Math.round(avgPainReduction * 10) / 10,
      trend: painScores,
    },
  };
}

export async function getFinancial(tenantId: string, dateRange: { startDate: string; endDate: string }) {
  const start = new Date(dateRange.startDate);
  const end = new Date(dateRange.endDate);

  const invoices = await prisma.invoice.findMany({
    where: { tenantId, createdAt: { gte: start, lte: end } },
  });

  const totalRevenue = invoices
    .filter((i) => i.status === InvoiceStatus.PAID)
    .reduce((sum, i) => sum + Number(i.total), 0);

  const totalBilled = invoices.reduce((sum, i) => sum + Number(i.total), 0);

  const collectionRate = totalBilled > 0 ? Math.round((totalRevenue / totalBilled) * 100) : 0;

  const medicalAidInvoices = invoices.filter((i) => i.medicalAidClaim);
  const approvedClaims = medicalAidInvoices.filter(
    (i) => i.status === InvoiceStatus.MEDICAL_AID_APPROVED || i.status === InvoiceStatus.PAID
  ).length;

  return {
    revenue: totalRevenue,
    totalBilled,
    collectionRate,
    outstanding: invoices
      .filter((i) => i.status === InvoiceStatus.UNPAID || i.status === InvoiceStatus.OVERDUE)
      .reduce((sum, i) => sum + Number(i.total), 0),
    medicalAid: {
      total: medicalAidInvoices.length,
      approved: approvedClaims,
      approvalRate: medicalAidInvoices.length > 0
        ? Math.round((approvedClaims / medicalAidInvoices.length) * 100)
        : 0,
    },
  };
}

export async function getOperational(tenantId: string, dateRange: { startDate: string; endDate: string }) {
  const start = new Date(dateRange.startDate);
  const end = new Date(dateRange.endDate);

  const appointments = await prisma.appointment.findMany({
    where: { tenantId, startAt: { gte: start, lte: end } },
  });

  const total = appointments.length;
  const noShows = appointments.filter((a) => a.status === AppointmentStatus.NO_SHOW).length;
  const cancelled = appointments.filter((a) => a.status === AppointmentStatus.CANCELLED).length;
  const completed = appointments.filter((a) => a.status === AppointmentStatus.COMPLETED).length;
  const uniquePatients = new Set(appointments.map((appointment) => appointment.patientId)).size;

  const waitTimes = appointments
    .filter((a) => a.status === AppointmentStatus.COMPLETED)
    .map((a) => {
      const createdAt = a.createdAt;
      return (a.startAt.getTime() - createdAt.getTime()) / 60000;
    });

  const avgWaitTime = waitTimes.length > 0
    ? Math.round(waitTimes.reduce((sum, t) => sum + t, 0) / waitTimes.length)
    : 0;

  return {
    totalAppointments: total,
    noShows,
    noShowRate: total > 0 ? Math.round((noShows / total) * 100) : 0,
    cancelled,
    cancellationRate: total > 0 ? Math.round((cancelled / total) * 100) : 0,
    completed,
    completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    uniquePatients,
    averageSessionsPerPatient: uniquePatients > 0 ? Math.round((total / uniquePatients) * 10) / 10 : 0,
    averageWaitTimeMinutes: avgWaitTime,
  };
}

export async function getTherapistPerformance(tenantId: string, therapistId: string, dateRange: { startDate: string; endDate: string }) {
  const start = new Date(dateRange.startDate);
  const end = new Date(dateRange.endDate);

  const appointments = await prisma.appointment.findMany({
    where: { tenantId, therapistId, startAt: { gte: start, lte: end } },
    include: { patient: { select: { id: true, firstName: true, lastName: true } } },
  });

  const total = appointments.length;
  const completed = appointments.filter((a) => a.status === AppointmentStatus.COMPLETED).length;
  const noShows = appointments.filter((a) => a.status === AppointmentStatus.NO_SHOW).length;
  const cancelled = appointments.filter((a) => a.status === AppointmentStatus.CANCELLED).length;

  const revenue = await prisma.invoice.aggregate({
    where: { tenantId, appointmentId: { in: appointments.map((a) => a.id) } },
    _sum: { total: true },
  });

  return {
    totalAppointments: total,
    completed,
    noShows,
    cancelled,
    completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    noShowRate: total > 0 ? Math.round((noShows / total) * 100) : 0,
    revenue: revenue._sum.total || 0,
    appointments,
  };
}

export async function getFinanceSummary(tenantId: string) {
  const invoices = await prisma.invoice.findMany({ where: { tenantId } });

  const byCategory = invoices.reduce((acc: Record<string, number>, inv) => {
    const items: any[] = inv.lineItems as any[];
    items.forEach((item) => {
      acc[item.description] = (acc[item.description] || 0) + Number(item.total);
    });
    return acc;
  }, {});

  const outstanding = invoices
    .filter((i) => i.status === InvoiceStatus.UNPAID || i.status === InvoiceStatus.OVERDUE)
    .reduce((sum, i) => sum + Number(i.total), 0);

  const totalBilled = invoices.reduce((sum, i) => sum + Number(i.total), 0);
  const paid = invoices.filter((i) => i.status === InvoiceStatus.PAID).reduce((sum, i) => sum + Number(i.total), 0);
  const collectionRate = totalBilled > 0 ? Math.round((paid / totalBilled) * 100) : 0;

  return {
    revenueByCategory: byCategory,
    outstanding,
    totalBilled,
    collected: paid,
    collectionRate,
  };
}

export async function getMonthlyTrend(tenantId: string, dateRange?: ReportDateRange) {
  const now = new Date();
  const defaultStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const start = dateRange ? new Date(dateRange.startDate) : defaultStart;
  const end = dateRange ? new Date(dateRange.endDate) : now;

  const invoices = await prisma.invoice.findMany({
    where: {
      tenantId,
      status: InvoiceStatus.PAID,
      paidAt: { gte: start, lte: end },
    },
    orderBy: { paidAt: 'asc' },
  });

  const monthlyData: Record<string, number> = {};
  const monthCursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const lastMonth = new Date(end.getFullYear(), end.getMonth(), 1);
  while (monthCursor <= lastMonth) {
    const d = new Date(monthCursor);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthlyData[key] = 0;
    monthCursor.setMonth(monthCursor.getMonth() + 1);
  }

  invoices.forEach((inv) => {
    if (inv.paidAt) {
      const key = `${inv.paidAt.getFullYear()}-${String(inv.paidAt.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyData[key] !== undefined) {
        monthlyData[key] += Number(inv.total);
      }
    }
  });

  return Object.entries(monthlyData)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, revenue]) => ({ month, revenue }));
}

/**
 * Returns member activity and the member's preferred payment method separately
 * from the methods used on recorded payment transactions.
 */
export async function getPatientReport(
  tenantId: string,
  dateRange: ReportDateRange,
  options: PatientReportOptions = {},
) {
  const { start, end } = toReportDates(dateRange);
  const where: any = { tenantId };

  if (options.paymentMethod) where.paymentMethod = options.paymentMethod;
  if (options.memberStatus) where.isActive = options.memberStatus === 'ACTIVE';

  const patients = await prisma.patient.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      patientCode: true,
      firstName: true,
      lastName: true,
      gender: true,
      dateOfBirth: true,
      paymentMethod: true,
      medicalAidName: true,
      isActive: true,
      createdAt: true,
      appointments: {
        where: { startAt: { gte: start, lte: end } },
        select: { id: true, status: true },
      },
      payments: {
        where: { paidAt: { gte: start, lte: end } },
        orderBy: { paidAt: 'desc' },
        select: { id: true, amount: true, status: true, paidAt: true, methodName: true },
      },
      invoices: {
        where: { status: { in: [InvoiceStatus.UNPAID, InvoiceStatus.OVERDUE] } },
        select: { total: true, status: true },
      },
    },
  });

  const members = patients.map((patient: any) => {
    const completedAppointments = patient.appointments.filter((appointment: any) => appointment.status === AppointmentStatus.COMPLETED).length;
    const noShows = patient.appointments.filter((appointment: any) => appointment.status === AppointmentStatus.NO_SHOW).length;
    const completedPayments = patient.payments.filter((payment: any) => payment.status === 'COMPLETED');
    const collectedAmount = sumAmounts(
      completedPayments,
      (payment: any) => payment.amount,
    );
    const outstandingBalance = sumAmounts(patient.invoices, (invoice: any) => invoice.total);

    return {
      id: patient.id,
      patientCode: patient.patientCode,
      firstName: patient.firstName,
      lastName: patient.lastName,
      gender: patient.gender,
      dateOfBirth: patient.dateOfBirth,
      joinedAt: patient.createdAt,
      isActive: patient.isActive,
      preferredPaymentMethod: methodLabel(patient.paymentMethod),
      medicalAidName: patient.medicalAidName || null,
      appointmentCount: patient.appointments.length,
      completedAppointments,
      noShows,
      paymentCount: patient.payments.length,
      completedPaymentCount: completedPayments.length,
      collectedAmount,
      outstandingBalance,
      lastPaymentAt: patient.payments[0]?.paidAt || null,
    };
  });

  const preferredPaymentMethods = new Map<string, {
    method: string;
    memberCount: number;
    activeMemberCount: number;
    newMemberCount: number;
    membersWithPayments: number;
    collectedAmount: number;
  }>();

  const coverage = new Map<string, {
    coverage: string;
    memberCount: number;
    activeMemberCount: number;
    collectedAmount: number;
    outstandingBalance: number;
  }>();

  for (const member of members) {
    const isNewMember = member.joinedAt >= start && member.joinedAt <= end;
    const method = preferredPaymentMethods.get(member.preferredPaymentMethod) || {
      method: member.preferredPaymentMethod,
      memberCount: 0,
      activeMemberCount: 0,
      newMemberCount: 0,
      membersWithPayments: 0,
      collectedAmount: 0,
    };
    method.memberCount += 1;
    method.activeMemberCount += member.isActive ? 1 : 0;
    method.newMemberCount += isNewMember ? 1 : 0;
    method.membersWithPayments += member.completedPaymentCount > 0 ? 1 : 0;
    method.collectedAmount = roundMoney(method.collectedAmount + member.collectedAmount);
    preferredPaymentMethods.set(member.preferredPaymentMethod, method);

    const coverageLabel = member.medicalAidName || 'Self-pay / not recorded';
    const coverageGroup = coverage.get(coverageLabel) || {
      coverage: coverageLabel,
      memberCount: 0,
      activeMemberCount: 0,
      collectedAmount: 0,
      outstandingBalance: 0,
    };
    coverageGroup.memberCount += 1;
    coverageGroup.activeMemberCount += member.isActive ? 1 : 0;
    coverageGroup.collectedAmount = roundMoney(coverageGroup.collectedAmount + member.collectedAmount);
    coverageGroup.outstandingBalance = roundMoney(coverageGroup.outstandingBalance + member.outstandingBalance);
    coverage.set(coverageLabel, coverageGroup);
  }

  const activeMembers = members.filter((member) => member.isActive).length;
  const membersSeen = members.filter((member) => member.appointmentCount > 0).length;
  const membersWithPayments = members.filter((member) => member.completedPaymentCount > 0).length;

  return {
    summary: {
      totalMembers: members.length,
      activeMembers,
      inactiveMembers: members.length - activeMembers,
      newMembers: members.filter((member) => member.joinedAt >= start && member.joinedAt <= end).length,
      membersSeen,
      membersWithPayments,
      totalCollected: sumAmounts(members, (member) => member.collectedAmount),
      totalOutstanding: sumAmounts(members, (member) => member.outstandingBalance),
      activityRate: activeMembers > 0 ? roundPercent((membersSeen / activeMembers) * 100) : 0,
    },
    byPreferredPaymentMethod: Array.from(preferredPaymentMethods.values())
      .sort((a, b) => b.memberCount - a.memberCount || a.method.localeCompare(b.method)),
    byCoverage: Array.from(coverage.values())
      .sort((a, b) => b.memberCount - a.memberCount || a.coverage.localeCompare(b.coverage)),
    members,
  };
}

export async function getPaymentReport(
  tenantId: string,
  dateRange: ReportDateRange,
  options: PaymentReportOptions = {},
) {
  const { start, end } = toReportDates(dateRange);
  const where: any = {
    tenantId,
    paidAt: { gte: start, lte: end },
  };

  if (options.status) where.status = options.status;
  if (options.paymentMethod) where.methodName = options.paymentMethod;

  const [payments, invoices] = await Promise.all([
    prisma.payment.findMany({
      where,
      orderBy: { paidAt: 'desc' },
      include: {
        patient: { select: { id: true, patientCode: true, firstName: true, lastName: true } },
        invoice: { select: { id: true, invoiceNumber: true } },
      },
    }),
    prisma.invoice.findMany({
      where: { tenantId, createdAt: { gte: start, lte: end } },
      select: { total: true, status: true, createdAt: true, paidAt: true },
    }),
  ]);

  const paymentRows = payments.map((payment: any) => ({
    id: payment.id,
    paidAt: payment.paidAt,
    patientId: payment.patientId,
    patientCode: payment.patient?.patientCode || null,
    patientName: payment.patient
      ? `${payment.patient.firstName} ${payment.patient.lastName}`
      : payment.patientId,
    invoiceNumber: payment.invoice?.invoiceNumber || null,
    amount: roundMoney(toAmount(payment.amount)),
    method: methodLabel(payment.methodName),
    status: payment.status,
    reference: payment.reference || null,
    notes: payment.notes || null,
  }));

  const completedPayments = paymentRows.filter((payment) => payment.status === 'COMPLETED');
  const refundedPayments = paymentRows.filter((payment) => payment.status === 'REFUNDED');
  const statusMap = new Map<string, { status: string; transactionCount: number; amount: number }>();
  const methodMap = new Map<string, {
    method: string;
    transactionCount: number;
    completedCount: number;
    patientCount: number;
    completedAmount: number;
    refundedAmount: number;
  } & { patientIds: Set<string> }>();

  for (const payment of paymentRows) {
    const status = statusMap.get(payment.status) || { status: payment.status, transactionCount: 0, amount: 0 };
    status.transactionCount += 1;
    status.amount = roundMoney(status.amount + payment.amount);
    statusMap.set(payment.status, status);

    const method = methodMap.get(payment.method) || {
      method: payment.method,
      transactionCount: 0,
      completedCount: 0,
      patientCount: 0,
      completedAmount: 0,
      refundedAmount: 0,
      patientIds: new Set<string>(),
    };
    method.transactionCount += 1;
    if (payment.patientId) method.patientIds.add(payment.patientId);
    if (payment.status === 'COMPLETED') {
      method.completedCount += 1;
      method.completedAmount = roundMoney(method.completedAmount + payment.amount);
    }
    if (payment.status === 'REFUNDED') {
      method.refundedAmount = roundMoney(method.refundedAmount + payment.amount);
    }
    methodMap.set(payment.method, method);
  }

  const totalBilled = sumAmounts(invoices, (invoice: any) => invoice.total);
  const outstandingBalance = sumAmounts(
    invoices.filter((invoice: any) => invoice.status === InvoiceStatus.UNPAID || invoice.status === InvoiceStatus.OVERDUE),
    (invoice: any) => invoice.total,
  );
  const paidInvoices = invoices.filter((invoice: any) => invoice.status === InvoiceStatus.PAID);
  const paymentCollected = sumAmounts(completedPayments, (payment) => payment.amount);
  const refundedAmount = sumAmounts(refundedPayments, (payment) => payment.amount);
  const paymentNet = roundMoney(paymentCollected - refundedAmount);
  const daysToPay = paidInvoices
    .filter((invoice: any) => invoice.paidAt && invoice.paidAt <= end)
    .map((invoice: any) => Math.max(0, invoice.paidAt.getTime() - invoice.createdAt.getTime()) / 86400000);
  const monthMap = new Map<string, { month: string; transactionCount: number; completedAmount: number }>();

  for (const payment of paymentRows) {
    const paidAt = new Date(payment.paidAt);
    const month = `${paidAt.getFullYear()}-${String(paidAt.getMonth() + 1).padStart(2, '0')}`;
    const monthData = monthMap.get(month) || { month, transactionCount: 0, completedAmount: 0 };
    monthData.transactionCount += 1;
    if (payment.status === 'COMPLETED') monthData.completedAmount = roundMoney(monthData.completedAmount + payment.amount);
    monthMap.set(month, monthData);
  }

  const byMethod = Array.from(methodMap.values())
    .map(({ patientIds, ...method }) => ({
      ...method,
      patientCount: patientIds.size,
      refundedAmount: roundMoney(method.refundedAmount),
      netAmount: roundMoney(method.completedAmount - method.refundedAmount),
      shareOfCollected: paymentCollected > 0 ? roundPercent((method.completedAmount / paymentCollected) * 100) : 0,
    }))
    .sort((a, b) => b.completedAmount - a.completedAmount || a.method.localeCompare(b.method));

  return {
    summary: {
      transactionCount: paymentRows.length,
      completedTransactions: completedPayments.length,
      pendingTransactions: paymentRows.filter((payment) => payment.status === 'PENDING').length,
      failedTransactions: paymentRows.filter((payment) => payment.status === 'FAILED').length,
      refundedTransactions: refundedPayments.length,
      membersPaid: new Set(completedPayments.map((payment) => payment.patientId)).size,
      collectedAmount: paymentCollected,
      refundedAmount,
      netCollected: paymentNet,
      pendingAmount: sumAmounts(paymentRows.filter((payment) => payment.status === 'PENDING'), (payment) => payment.amount),
      failedAmount: sumAmounts(paymentRows.filter((payment) => payment.status === 'FAILED'), (payment) => payment.amount),
      totalBilled,
      outstandingBalance,
      collectionRate: totalBilled > 0 ? roundPercent((paymentCollected / totalBilled) * 100) : 0,
      averageDaysToPay: daysToPay.length > 0 ? roundPercent(daysToPay.reduce((sum, days) => sum + days, 0) / daysToPay.length) : 0,
    },
    byStatus: Array.from(statusMap.values()).sort((a, b) => b.transactionCount - a.transactionCount),
    byMethod,
    monthlyTrend: Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month)),
    payments: paymentRows,
  };
}
