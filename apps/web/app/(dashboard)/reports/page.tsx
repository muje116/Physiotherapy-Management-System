'use client';

import { ComponentType, useEffect, useState } from 'react';
import {
  Activity,
  CreditCard,
  Download,
  FileText,
  RefreshCw,
  Users,
  Wallet,
} from 'lucide-react';
import api from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/status-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface DashboardData {
  outcomeData: { month: string; averageScore: number; measureCount: number }[];
  revenueData: { month: string; revenue: number }[];
  operationalData: { metric: string; utilisation: number; noShows: number }[];
  collectionRate: number;
  avgDaysToPay: number;
  outstandingBalance: number;
  avgUtilisation: string;
  noShowRate: string;
  avgSessions: string;
}

interface MemberReport {
  summary: {
    totalMembers: number;
    activeMembers: number;
    inactiveMembers: number;
    newMembers: number;
    membersSeen: number;
    membersWithPayments: number;
    totalCollected: number;
    totalOutstanding: number;
    activityRate: number;
  };
  byPreferredPaymentMethod: {
    method: string;
    memberCount: number;
    activeMemberCount: number;
    newMemberCount: number;
    membersWithPayments: number;
    collectedAmount: number;
  }[];
  byCoverage: {
    coverage: string;
    memberCount: number;
    activeMemberCount: number;
    collectedAmount: number;
    outstandingBalance: number;
  }[];
  members: {
    id: string;
    patientCode: string;
    firstName: string;
    lastName: string;
    gender: string | null;
    dateOfBirth: string;
    joinedAt: string;
    isActive: boolean;
    preferredPaymentMethod: string;
    medicalAidName: string | null;
    appointmentCount: number;
    completedAppointments: number;
    noShows: number;
    paymentCount: number;
    completedPaymentCount: number;
    collectedAmount: number;
    outstandingBalance: number;
    lastPaymentAt: string | null;
  }[];
}

interface PaymentReport {
  summary: {
    transactionCount: number;
    completedTransactions: number;
    pendingTransactions: number;
    failedTransactions: number;
    refundedTransactions: number;
    membersPaid: number;
    collectedAmount: number;
    refundedAmount: number;
    netCollected: number;
    pendingAmount: number;
    failedAmount: number;
    totalBilled: number;
    outstandingBalance: number;
    collectionRate: number;
    averageDaysToPay: number;
  };
  byStatus: { status: string; transactionCount: number; amount: number }[];
  byMethod: {
    method: string;
    transactionCount: number;
    completedCount: number;
    patientCount: number;
    completedAmount: number;
    refundedAmount: number;
    netAmount: number;
    shareOfCollected: number;
  }[];
  monthlyTrend: { month: string; transactionCount: number; completedAmount: number }[];
  payments: {
    id: string;
    paidAt: string;
    patientId: string;
    patientCode: string | null;
    patientName: string;
    invoiceNumber: string | null;
    amount: number;
    method: string;
    status: string;
    reference: string | null;
    notes: string | null;
  }[];
}

interface MedicalSchemePaymentReport {
  summary: { transactionCount: number; patientCount: number; schemeCount: number; collectedAmount: number };
  byScheme: { schemeId: string | null; scheme: string; schemeCode: string | null; patientCount: number; transactionCount: number; collectedAmount: number }[];
  patients: {
    id: string;
    paidAt: string;
    patientCode: string | null;
    patientName: string;
    medicalAidNumber: string | null;
    scheme: string;
    schemeCode: string | null;
    claimReference: string | null;
    claimStatus: string | null;
    invoiceNumber: string | null;
    amount: number;
    method: string;
    reference: string | null;
  }[];
}

interface QueuedExport {
  id: string;
  type: string;
  format: 'pdf' | 'csv';
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  fileName?: string | null;
  error?: string | null;
  createdAt?: string;
  completedAt?: string | null;
}

type DateFilters = { from: string; to: string };

const PAYMENT_STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'REFUNDED', label: 'Refunded' },
];

const MEMBER_METHOD_OPTIONS = [
  { value: '', label: 'All preferred methods' },
  { value: 'CASH', label: 'Cash' },
  { value: 'INSURANCE', label: 'Insurance / medical aid' },
];

const MEMBER_STATUS_OPTIONS = [
  { value: '', label: 'All member statuses' },
  { value: 'ACTIVE', label: 'Active members' },
  { value: 'INACTIVE', label: 'Inactive members' },
];

const SERVER_EXPORT_TYPE_OPTIONS = [
  { value: 'members', label: 'Members' },
  { value: 'payments', label: 'Payments' },
  { value: 'medical-scheme-payments', label: 'Medical scheme collections' },
  { value: 'financial', label: 'Financial' },
  { value: 'clinical', label: 'Clinical' },
  { value: 'operational', label: 'Operational' },
  { value: 'therapist', label: 'Therapist performance' },
];

const SERVER_EXPORT_FORMAT_OPTIONS = [
  { value: 'csv', label: 'CSV' },
  { value: 'pdf', label: 'PDF' },
];

function defaultDateFilters(): DateFilters {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  return {
    from: from.toISOString().slice(0, 10),
    to: now.toISOString().slice(0, 10),
  };
}

function reportQuery(filters: DateFilters, extras: Record<string, string> = {}) {
  const params = new URLSearchParams({
    startDate: new Date(`${filters.from}T00:00:00`).toISOString(),
    endDate: new Date(`${filters.to}T23:59:59.999`).toISOString(),
  });

  Object.entries(extras).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });

  return params.toString();
}

function formatMoney(value: number) {
  return `R ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString();
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

function formatMethod(value: string) {
  return value.replace(/_/g, ' ');
}

function csvCell(value: unknown) {
  const text = String(value ?? '');
  const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replace(/"/g, '""')}"`;
}

function downloadCsv(rows: unknown[][], filename: string) {
  const csv = rows.map((row) => row.map(csvCell).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const [filters, setFilters] = useState<DateFilters>(() => defaultDateFilters());
  const [memberMethod, setMemberMethod] = useState('');
  const [memberStatus, setMemberStatus] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [memberReport, setMemberReport] = useState<MemberReport | null>(null);
  const [paymentReport, setPaymentReport] = useState<PaymentReport | null>(null);
  const [medicalSchemeReport, setMedicalSchemeReport] = useState<MedicalSchemePaymentReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [serverExportType, setServerExportType] = useState('members');
  const [serverExportFormat, setServerExportFormat] = useState<'csv' | 'pdf'>('csv');
  const [serverExport, setServerExport] = useState<QueuedExport | null>(null);
  const [serverExportLoading, setServerExportLoading] = useState(false);
  const [serverExportError, setServerExportError] = useState<string | null>(null);

  const loadReports = async () => {
    if (!filters.from || !filters.to || filters.from > filters.to) {
      setError('Choose a valid date range where the start date is not after the end date.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const baseQuery = reportQuery(filters);
      const memberQuery = reportQuery(filters, { paymentMethod: memberMethod, memberStatus });
      const paymentQuery = reportQuery(filters, { paymentMethod, status: paymentStatus });
      const [dashboardResponse, memberResponse, paymentResponse, medicalSchemeResponse] = await Promise.all([
        api.get(`/reports?${baseQuery}`),
        api.get(`/reports/patients?${memberQuery}`),
        api.get(`/reports/payments?${paymentQuery}`),
        api.get(`/reports/medical-scheme-payments?${baseQuery}`),
      ]);

      setDashboard(dashboardResponse.data.data);
      setMemberReport(memberResponse.data.data);
      setPaymentReport(paymentResponse.data.data);
      setMedicalSchemeReport(medicalSchemeResponse.data.data);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Unable to load reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReports();
    // The first load intentionally uses the initial filter state; later loads
    // are triggered explicitly by the Apply button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!serverExport || !['QUEUED', 'PROCESSING'].includes(serverExport.status)) return;

    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      try {
        const response = await api.get(`/reports/exports/${serverExport.id}`);
        if (!cancelled) setServerExport(response.data.data);
      } catch (err: any) {
        if (!cancelled) setServerExportError(err.response?.data?.error?.message || err.message || 'Unable to check export status');
      }
    }, 1500);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [serverExport]);

  const queueServerExport = async () => {
    if (!filters.from || !filters.to || filters.from > filters.to) {
      setServerExportError('Choose a valid date range before exporting.');
      return;
    }

    setServerExportLoading(true);
    setServerExportError(null);
    try {
      const response = await api.post('/reports/export', {
        type: serverExportType,
        format: serverExportFormat,
        dateRange: {
          startDate: new Date(`${filters.from}T00:00:00`).toISOString(),
          endDate: new Date(`${filters.to}T23:59:59.999`).toISOString(),
        },
      });
      setServerExport(response.data.data);
    } catch (err: any) {
      setServerExportError(err.response?.data?.error?.message || err.message || 'Unable to queue export');
    } finally {
      setServerExportLoading(false);
    }
  };

  const downloadServerExport = async () => {
    if (!serverExport || serverExport.status !== 'COMPLETED') return;

    try {
      setServerExportError(null);
      const response = await api.get(`/reports/exports/${serverExport.id}/download`, { responseType: 'blob' });
      const contentType = response.headers['content-type'];
      const blob = new Blob([response.data], { type: typeof contentType === 'string' ? contentType : undefined });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = serverExport.fileName || `${serverExport.type}-${serverExport.id}.${serverExport.format}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setServerExportError(err.response?.data?.error?.message || err.message || 'Unable to download export');
    }
  };

  const exportCsv = () => {
    if (!dashboard || !memberReport || !paymentReport || !medicalSchemeReport) return;

    const rows: unknown[][] = [
      ['PhysioCore report export'],
      ['From', filters.from, 'To', filters.to],
      [],
      ['Member summary'],
      ['Metric', 'Value'],
      ['Total members', memberReport.summary.totalMembers],
      ['Active members', memberReport.summary.activeMembers],
      ['Inactive members', memberReport.summary.inactiveMembers],
      ['New members', memberReport.summary.newMembers],
      ['Members seen', memberReport.summary.membersSeen],
      ['Members with payments', memberReport.summary.membersWithPayments],
      ['Collected from members', memberReport.summary.totalCollected],
      ['Outstanding member balance', memberReport.summary.totalOutstanding],
      [],
      ['Members by preferred payment method'],
      ['Method', 'Members', 'Active', 'New', 'Members with payments', 'Collected'],
      ...memberReport.byPreferredPaymentMethod.map((row) => [
        row.method,
        row.memberCount,
        row.activeMemberCount,
        row.newMemberCount,
        row.membersWithPayments,
        row.collectedAmount,
      ]),
      [],
      ['Members by coverage'],
      ['Coverage', 'Members', 'Active', 'Collected', 'Outstanding'],
      ...memberReport.byCoverage.map((row) => [
        row.coverage,
        row.memberCount,
        row.activeMemberCount,
        row.collectedAmount,
        row.outstandingBalance,
      ]),
      [],
      ['Member detail'],
      ['Patient code', 'Member', 'Status', 'Joined', 'Preferred method', 'Medical aid', 'Appointments', 'Completed', 'No-shows', 'Transactions', 'Completed payments', 'Collected', 'Outstanding'],
      ...memberReport.members.map((row) => [
        row.patientCode,
        `${row.firstName} ${row.lastName}`,
        row.isActive ? 'Active' : 'Inactive',
        formatDate(row.joinedAt),
        row.preferredPaymentMethod,
        row.medicalAidName || 'Not recorded',
        row.appointmentCount,
        row.completedAppointments,
        row.noShows,
        row.paymentCount,
        row.completedPaymentCount,
        row.collectedAmount,
        row.outstandingBalance,
      ]),
      [],
      ['Payment summary'],
      ['Metric', 'Value'],
      ['Transactions', paymentReport.summary.transactionCount],
      ['Completed transactions', paymentReport.summary.completedTransactions],
      ['Pending transactions', paymentReport.summary.pendingTransactions],
      ['Failed transactions', paymentReport.summary.failedTransactions],
      ['Refunded transactions', paymentReport.summary.refundedTransactions],
      ['Members paid', paymentReport.summary.membersPaid],
      ['Collected amount', paymentReport.summary.collectedAmount],
      ['Refunded amount', paymentReport.summary.refundedAmount],
      ['Net collected', paymentReport.summary.netCollected],
      ['Billed amount', paymentReport.summary.totalBilled],
      ['Outstanding balance', paymentReport.summary.outstandingBalance],
      [],
      ['Payments by method'],
      ['Method', 'Transactions', 'Members', 'Completed', 'Collected', 'Refunded', 'Net', 'Share of collected'],
      ...paymentReport.byMethod.map((row) => [
        row.method,
        row.transactionCount,
        row.patientCount,
        row.completedCount,
        row.completedAmount,
        row.refundedAmount,
        row.netAmount,
        `${row.shareOfCollected}%`,
      ]),
      [],
      ['Payment activity by month'],
      ['Month', 'Transactions', 'Completed collections'],
      ...paymentReport.monthlyTrend.map((row) => [row.month, row.transactionCount, row.completedAmount]),
      [],
      ['Payment detail'],
      ['Date', 'Patient code', 'Patient', 'Invoice', 'Amount', 'Method', 'Status', 'Reference', 'Notes'],
      ...paymentReport.payments.map((row) => [
        formatDateTime(row.paidAt),
        row.patientCode || row.patientId,
        row.patientName,
        row.invoiceNumber || '',
        row.amount,
        row.method,
        row.status,
        row.reference || '',
        row.notes || '',
      ]),
      [],
      ['Medical scheme collections'],
      ['Scheme', 'Scheme code', 'Patient code', 'Patient', 'Medical aid number', 'Invoice', 'Date', 'Amount', 'Method', 'Reference'],
      ...medicalSchemeReport.patients.map((row) => [
        row.scheme,
        row.schemeCode || '',
        row.patientCode || '',
        row.patientName,
        row.medicalAidNumber || '',
        row.invoiceNumber || '',
        formatDateTime(row.paidAt),
        row.amount,
        row.method,
        row.reference || '',
      ]),
      [],
      ['Dashboard financial summary'],
      ['Collection rate', `${dashboard.collectionRate}%`],
      ['Average days to pay', dashboard.avgDaysToPay],
      ['Outstanding balance', dashboard.outstandingBalance],
    ];

    downloadCsv(rows, `physiocore-reports-${filters.from}-to-${filters.to}.csv`);
  };

  const paymentMethodOptions = [
    { value: '', label: 'All payment methods' },
    ...Array.from(new Set([
      'Cash',
      'Credit Card',
      'EFT',
      'Debit Order',
      'Medical Aid',
      ...(paymentReport?.byMethod || []).map((row) => row.method),
    ])).map((method) => ({ value: method, label: formatMethod(method) })),
  ];

  if (loading && !dashboard) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-20" />
        <div className="grid gap-4 md:grid-cols-4"><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!dashboard || !memberReport || !paymentReport || !medicalSchemeReport) {
    return <div className="space-y-4"><p className="text-destructive">{error || 'Reports are unavailable.'}</p><Button onClick={() => void loadReports()}>Retry</Button></div>;
  }

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports &amp; Analytics</h1>
          <p className="text-muted-foreground">Members, payments, clinical outcomes, and practice performance</p>
        </div>
        <div className="flex gap-2 print:hidden">
          <Button variant="outline" onClick={() => window.print()}>
            <FileText className="mr-2 h-4 w-4" /> Print / PDF
          </Button>
          <Button variant="outline" onClick={exportCsv}>
            <Download className="mr-2 h-4 w-4" /> CSV export
          </Button>
        </div>
      </div>

      <Card className="print:hidden">
        <CardContent className="flex flex-col gap-3 pt-6">
          <div>
            <p className="font-medium">Server report export</p>
            <p className="text-sm text-muted-foreground">Generate a durable report in the background for download when ready.</p>
          </div>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <Select options={SERVER_EXPORT_TYPE_OPTIONS} value={serverExportType} onChange={(event) => setServerExportType(event.target.value)} className="lg:w-56" />
            <Select options={SERVER_EXPORT_FORMAT_OPTIONS} value={serverExportFormat} onChange={(event) => setServerExportFormat(event.target.value as 'csv' | 'pdf')} className="lg:w-32" />
            <Button onClick={() => void queueServerExport()} disabled={serverExportLoading}>
              {serverExportLoading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Queue export
            </Button>
            {serverExport && <Badge variant={serverExport.status === 'FAILED' ? 'destructive' : 'secondary'}>{serverExport.status}</Badge>}
            {serverExport?.status === 'COMPLETED' && <Button variant="outline" onClick={() => void downloadServerExport()}>Download</Button>}
          </div>
          {serverExport?.status === 'FAILED' && <p className="text-sm text-destructive">{serverExport.error || 'The report export failed.'}</p>}
          {serverExportError && <p className="text-sm text-destructive">{serverExportError}</p>}
        </CardContent>
      </Card>

      <Card className="print:hidden">
        <CardContent className="flex flex-col gap-4 pt-6 xl:flex-row xl:items-end">
          <div className="grid flex-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="report-from">From</Label>
              <Input id="report-from" type="date" value={filters.from} onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="report-to">To</Label>
              <Input id="report-to" type="date" value={filters.to} onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))} />
            </div>
          </div>
          <div className="grid flex-[2] gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1">
              <Label>Preferred member method</Label>
              <Select options={MEMBER_METHOD_OPTIONS} value={memberMethod} onChange={(event) => setMemberMethod(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Member status</Label>
              <Select options={MEMBER_STATUS_OPTIONS} value={memberStatus} onChange={(event) => setMemberStatus(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Recorded payment method</Label>
              <Select options={paymentMethodOptions} value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Payment status</Label>
              <Select options={PAYMENT_STATUS_OPTIONS} value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)} />
            </div>
          </div>
          <Button onClick={() => void loadReports()} disabled={loading} className="xl:min-w-32">
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Apply
          </Button>
        </CardContent>
      </Card>

      {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive print:hidden">{error}</div>}

      <Tabs defaultValue="members">
        <TabsList className="flex h-auto w-full justify-start overflow-x-auto print:hidden">
          <TabsTrigger value="members"><Users className="mr-2 h-4 w-4" /> Members</TabsTrigger>
          <TabsTrigger value="payments"><Wallet className="mr-2 h-4 w-4" /> Payments</TabsTrigger>
          <TabsTrigger value="medical-schemes"><CreditCard className="mr-2 h-4 w-4" /> Medical schemes</TabsTrigger>
          <TabsTrigger value="financial">Financial</TabsTrigger>
          <TabsTrigger value="clinical">Clinical</TabsTrigger>
          <TabsTrigger value="operational">Operational</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Total members" value={String(memberReport.summary.totalMembers)} subtitle={`${memberReport.summary.activeMembers} active`} icon={Users} />
            <StatCard title="New members" value={String(memberReport.summary.newMembers)} subtitle={`joined ${filters.from} to ${filters.to}`} icon={Activity} />
            <StatCard title="Members seen" value={String(memberReport.summary.membersSeen)} subtitle={`${memberReport.summary.activityRate}% of active members`} icon={Activity} />
            <StatCard title="Collected from members" value={formatMoney(memberReport.summary.totalCollected)} subtitle={`${memberReport.summary.membersWithPayments} members paid`} icon={Wallet} />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Members by preferred payment method</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Method</TableHead><TableHead>Members</TableHead><TableHead>Active</TableHead><TableHead>New</TableHead><TableHead>Paid members</TableHead><TableHead>Collected</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {memberReport.byPreferredPaymentMethod.map((row) => (
                      <TableRow key={row.method}>
                        <TableCell><Badge variant="outline">{formatMethod(row.method)}</Badge></TableCell>
                        <TableCell>{row.memberCount}</TableCell>
                        <TableCell>{row.activeMemberCount}</TableCell>
                        <TableCell>{row.newMemberCount}</TableCell>
                        <TableCell>{row.membersWithPayments}</TableCell>
                        <TableCell>{formatMoney(row.collectedAmount)}</TableCell>
                      </TableRow>
                    ))}
                    {memberReport.byPreferredPaymentMethod.length === 0 && <EmptyRow colSpan={6} label="No member payment preferences recorded" />}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Members by coverage</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Coverage</TableHead><TableHead>Members</TableHead><TableHead>Active</TableHead><TableHead>Collected</TableHead><TableHead>Outstanding</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {memberReport.byCoverage.map((row) => (
                      <TableRow key={row.coverage}>
                        <TableCell className="font-medium">{row.coverage}</TableCell>
                        <TableCell>{row.memberCount}</TableCell>
                        <TableCell>{row.activeMemberCount}</TableCell>
                        <TableCell>{formatMoney(row.collectedAmount)}</TableCell>
                        <TableCell>{formatMoney(row.outstandingBalance)}</TableCell>
                      </TableRow>
                    ))}
                    {memberReport.byCoverage.length === 0 && <EmptyRow colSpan={5} label="No coverage data" />}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-base">Member activity detail</CardTitle><span className="text-sm text-muted-foreground">{memberReport.members.length} members</span></CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Member</TableHead><TableHead>Status</TableHead><TableHead>Joined</TableHead><TableHead>Preferred method</TableHead><TableHead>Visits</TableHead><TableHead>Payments</TableHead><TableHead>Collected</TableHead><TableHead>Outstanding</TableHead></TableRow></TableHeader>
                <TableBody>
                  {memberReport.members.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell><div className="font-medium">{member.firstName} {member.lastName}</div><div className="text-xs text-muted-foreground">{member.patientCode}</div></TableCell>
                      <TableCell><Badge variant={member.isActive ? 'default' : 'secondary'}>{member.isActive ? 'Active' : 'Inactive'}</Badge></TableCell>
                      <TableCell>{formatDate(member.joinedAt)}</TableCell>
                      <TableCell>{formatMethod(member.preferredPaymentMethod)}</TableCell>
                      <TableCell>{member.appointmentCount} <span className="text-xs text-muted-foreground">({member.completedAppointments} completed)</span></TableCell>
                      <TableCell>{member.paymentCount} <span className="text-xs text-muted-foreground">({member.completedPaymentCount} completed)</span></TableCell>
                      <TableCell>{formatMoney(member.collectedAmount)}</TableCell>
                      <TableCell>{formatMoney(member.outstandingBalance)}</TableCell>
                    </TableRow>
                  ))}
                  {memberReport.members.length === 0 && <EmptyRow colSpan={8} label="No members match the selected filters" />}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Collected" value={formatMoney(paymentReport.summary.collectedAmount)} subtitle={`${paymentReport.summary.completedTransactions} completed`} icon={Wallet} />
            <StatCard title="Net collected" value={formatMoney(paymentReport.summary.netCollected)} subtitle={`${formatMoney(paymentReport.summary.refundedAmount)} refunded`} icon={CreditCard} />
            <StatCard title="Transactions" value={String(paymentReport.summary.transactionCount)} subtitle={`${paymentReport.summary.membersPaid} members paid`} icon={Activity} />
            <StatCard title="Outstanding" value={formatMoney(paymentReport.summary.outstandingBalance)} subtitle={`${paymentReport.summary.collectionRate}% collection rate`} icon={Wallet} />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Collected payments by method</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Method</TableHead><TableHead>Transactions</TableHead><TableHead>Members</TableHead><TableHead>Collected</TableHead><TableHead>Share</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {paymentReport.byMethod.map((row) => (
                      <TableRow key={row.method}>
                        <TableCell><Badge variant="outline">{formatMethod(row.method)}</Badge></TableCell>
                        <TableCell>{row.transactionCount}</TableCell>
                        <TableCell>{row.patientCount}</TableCell>
                        <TableCell>{formatMoney(row.completedAmount)}</TableCell>
                        <TableCell>{row.shareOfCollected}%</TableCell>
                      </TableRow>
                    ))}
                    {paymentReport.byMethod.length === 0 && <EmptyRow colSpan={5} label="No payments match the selected filters" />}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Transactions by status</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Status</TableHead><TableHead>Transactions</TableHead><TableHead>Amount</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {paymentReport.byStatus.map((row) => (
                      <TableRow key={row.status}><TableCell><StatusBadge status={row.status} /></TableCell><TableCell>{row.transactionCount}</TableCell><TableCell>{formatMoney(row.amount)}</TableCell></TableRow>
                    ))}
                    {paymentReport.byStatus.length === 0 && <EmptyRow colSpan={3} label="No payment statuses in this period" />}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Payment activity by month</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Month</TableHead><TableHead>Transactions</TableHead><TableHead>Completed collections</TableHead></TableRow></TableHeader>
                <TableBody>
                  {paymentReport.monthlyTrend.map((row) => <TableRow key={row.month}><TableCell>{row.month}</TableCell><TableCell>{row.transactionCount}</TableCell><TableCell>{formatMoney(row.completedAmount)}</TableCell></TableRow>)}
                  {paymentReport.monthlyTrend.length === 0 && <EmptyRow colSpan={3} label="No payment activity in this period" />}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-base">Payment transaction detail</CardTitle><span className="text-sm text-muted-foreground">{paymentReport.payments.length} transactions</span></CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Member</TableHead><TableHead>Invoice</TableHead><TableHead>Amount</TableHead><TableHead>Method</TableHead><TableHead>Status</TableHead><TableHead>Reference</TableHead></TableRow></TableHeader>
                <TableBody>
                  {paymentReport.payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>{formatDateTime(payment.paidAt)}</TableCell>
                      <TableCell><div className="font-medium">{payment.patientName}</div><div className="text-xs text-muted-foreground">{payment.patientCode || payment.patientId}</div></TableCell>
                      <TableCell>{payment.invoiceNumber || '-'}</TableCell>
                      <TableCell>{formatMoney(payment.amount)}</TableCell>
                      <TableCell><Badge variant="outline">{formatMethod(payment.method)}</Badge></TableCell>
                      <TableCell><StatusBadge status={payment.status} /></TableCell>
                      <TableCell>{payment.reference || '-'}</TableCell>
                    </TableRow>
                  ))}
                  {paymentReport.payments.length === 0 && <EmptyRow colSpan={7} label="No payments match the selected filters" />}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="medical-schemes" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Collected" value={formatMoney(medicalSchemeReport.summary.collectedAmount)} subtitle={`${medicalSchemeReport.summary.transactionCount} completed transactions`} icon={Wallet} />
            <StatCard title="Patients" value={String(medicalSchemeReport.summary.patientCount)} subtitle="paid through a medical scheme" icon={Users} />
            <StatCard title="Schemes" value={String(medicalSchemeReport.summary.schemeCount)} subtitle="grouped in this period" icon={CreditCard} />
            <StatCard title="Period" value={filters.from} subtitle={`to ${filters.to}`} icon={Activity} />
          </div>
          <Card>
            <CardHeader><CardTitle className="text-base">Collections by scheme</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Scheme</TableHead><TableHead>Code</TableHead><TableHead>Patients</TableHead><TableHead>Transactions</TableHead><TableHead>Collected</TableHead></TableRow></TableHeader>
                <TableBody>
                  {medicalSchemeReport.byScheme.map((row) => <TableRow key={`${row.schemeId || 'unlinked'}-${row.scheme}`}><TableCell className="font-medium">{row.scheme}</TableCell><TableCell>{row.schemeCode || '-'}</TableCell><TableCell>{row.patientCount}</TableCell><TableCell>{row.transactionCount}</TableCell><TableCell>{formatMoney(row.collectedAmount)}</TableCell></TableRow>)}
                  {medicalSchemeReport.byScheme.length === 0 && <EmptyRow colSpan={5} label="No medical scheme collections in this period" />}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-base">Patients who paid by medical scheme</CardTitle><span className="text-sm text-muted-foreground">{medicalSchemeReport.patients.length} transactions</span></CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Scheme</TableHead><TableHead>Patient</TableHead><TableHead>Medical aid number</TableHead><TableHead>Invoice</TableHead><TableHead>Amount</TableHead><TableHead>Claim</TableHead><TableHead>Reference</TableHead></TableRow></TableHeader>
                <TableBody>
                  {medicalSchemeReport.patients.map((row) => <TableRow key={row.id}><TableCell>{formatDateTime(row.paidAt)}</TableCell><TableCell><div className="font-medium">{row.scheme}</div><div className="text-xs text-muted-foreground">{row.schemeCode || 'Not linked'}</div></TableCell><TableCell><div className="font-medium">{row.patientName}</div><div className="text-xs text-muted-foreground">{row.patientCode || row.patientName}</div></TableCell><TableCell>{row.medicalAidNumber || '-'}</TableCell><TableCell>{row.invoiceNumber || '-'}</TableCell><TableCell>{formatMoney(row.amount)}</TableCell><TableCell>{row.claimReference || row.claimStatus || '-'}</TableCell><TableCell>{row.reference || '-'}</TableCell></TableRow>)}
                  {medicalSchemeReport.patients.length === 0 && <EmptyRow colSpan={8} label="No medical scheme patients in this period" />}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="financial" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Collection rate" value={`${paymentReport.summary.collectionRate}%`} subtitle={`${formatMoney(paymentReport.summary.collectedAmount)} collected`} icon={Wallet} />
            <StatCard title="Average days to pay" value={`${paymentReport.summary.averageDaysToPay}`} subtitle="from invoice creation to payment" icon={Activity} />
            <StatCard title="Billed" value={formatMoney(paymentReport.summary.totalBilled)} subtitle="invoices created in period" icon={FileText} />
            <StatCard title="Outstanding" value={formatMoney(paymentReport.summary.outstandingBalance)} subtitle="unpaid or overdue invoices" icon={Wallet} />
          </div>
          <Card>
            <CardHeader><CardTitle className="text-base">Revenue by month</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Month</TableHead><TableHead>Revenue</TableHead></TableRow></TableHeader>
                <TableBody>
                  {dashboard.revenueData.map((row) => <TableRow key={row.month}><TableCell>{row.month}</TableCell><TableCell>{formatMoney(row.revenue)}</TableCell></TableRow>)}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clinical" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Outcome measure trends</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Month</TableHead><TableHead>Average score</TableHead><TableHead>Measures recorded</TableHead></TableRow></TableHeader>
                <TableBody>
                  {dashboard.outcomeData.map((row) => <TableRow key={row.month}><TableCell>{row.month}</TableCell><TableCell>{row.averageScore}</TableCell><TableCell>{row.measureCount}</TableCell></TableRow>)}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="operational" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard title="Average utilisation" value={dashboard.avgUtilisation} subtitle="booked practice capacity" icon={Activity} />
            <StatCard title="No-show rate" value={dashboard.noShowRate} subtitle="appointments in period" icon={Activity} />
            <StatCard title="Average sessions / member" value={dashboard.avgSessions} subtitle="based on recorded outcomes" icon={Users} />
          </div>
          <Card>
            <CardHeader><CardTitle className="text-base">Operational snapshot</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Period</TableHead><TableHead>Utilisation</TableHead><TableHead>No-shows</TableHead></TableRow></TableHeader>
                <TableBody>{dashboard.operationalData.map((row) => <TableRow key={row.metric}><TableCell>{row.metric}</TableCell><TableCell>{row.utilisation}%</TableCell><TableCell>{row.noShows}</TableCell></TableRow>)}</TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return <TableRow><TableCell colSpan={colSpan} className="py-8 text-center text-muted-foreground">{label}</TableCell></TableRow>;
}
