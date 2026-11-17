'use client';

import { useEffect, useState } from 'react';
import { DashboardMetrics } from '@/components/dashboard-metrics';
import { RevenueChart } from '@/components/revenue-chart';
import { AppointmentsChart } from '@/components/appointments-chart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight, Bell, CalendarDays, CheckSquare, ClipboardList, Sparkles, UsersRound } from 'lucide-react';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { formatCurrency } from '@/lib/utils';
import { hasPermission } from '@/lib/permissions';

interface DashboardData {
  metrics: { totalPatients: number; todayAppointments: number; revenueThisMonth: number; outstandingInvoices: number; noShowRate: string; therapistUtilisation: string };
  revenueTrend: { month: string; revenue: number }[];
  appointmentsByType: { type: string; count: number }[];
  todayAppts: { id: string; time: string; patient: string; therapist: string; type: string; status: string }[];
}

interface FollowUpStats { pending: number }
interface TreatmentPlanInfo { total: number }
interface ClientTaskStats { pending: number }

export default function DashboardPage() {
  const { user } = useAuth();
  const currency = user?.tenant?.currency || 'ZAR';
  const canViewPractice = hasPermission(user, 'finance:read');
  const [data, setData] = useState<DashboardData | null>(null);
  const [profile, setProfile] = useState<{ jobTitle?: string | null; department?: string | null; phone?: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [followUpStats, setFollowUpStats] = useState<FollowUpStats | null>(null);
  const [treatmentPlans, setTreatmentPlans] = useState<TreatmentPlanInfo | null>(null);
  const [taskStats, setTaskStats] = useState<ClientTaskStats | null>(null);

  useEffect(() => {
    if (!user) return;
    if (!canViewPractice) {
      api.get('/users/me')
        .then(({ data: response }) => setProfile(response.data))
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
      return;
    }

    Promise.all([
      api.get('/reports/dashboard'),
      api.get('/notifications/follow-ups/stats').catch(() => ({ data: { data: null } })),
      api.get('/treatment-plans?status=ACTIVE').catch(() => ({ data: { data: null } })),
      api.get('/client-tasks/stats').catch(() => ({ data: { data: null } })),
    ]).then(([dashRes, fupRes, tpRes, ctRes]) => {
      const dashboard = dashRes.data.data ?? {};
      const metrics = dashboard.metrics ?? {
        totalPatients: dashboard.totalPatients ?? 0,
        todayAppointments: dashboard.todayAppointments ?? 0,
        revenueThisMonth: Number(dashboard.revenueThisMonth ?? 0),
        outstandingInvoices: Number(dashboard.outstandingInvoices ?? 0),
        noShowRate: typeof dashboard.noShowRate === 'number' ? `${dashboard.noShowRate}%` : (dashboard.noShowRate ?? '0%'),
        therapistUtilisation: typeof dashboard.utilisation === 'number' ? `${dashboard.utilisation}%` : (dashboard.therapistUtilisation ?? '0%'),
      };

      setData({
        metrics,
        revenueTrend: dashboard.revenueTrend ?? [],
        appointmentsByType: dashboard.appointmentsByType ?? [],
        todayAppts: dashboard.todayAppts ?? [],
      });
      setFollowUpStats(fupRes.data.data);
      setTreatmentPlans(tpRes.data.data);
      setTaskStats(ctRes.data.data);
    }).catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [canViewPractice, user?.id]);

  if (loading) return (
    <div className="mx-auto max-w-7xl space-y-8">
      <Skeleton className="h-48 rounded-[1.75rem]" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-36 rounded-[1.5rem]" />)}
      </div>
    </div>
  );
  if (error) return (
    <div className="mx-auto max-w-7xl">
      <Card className="rounded-3xl border-red-100 bg-white shadow-sm">
        <CardContent className="p-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-500">Dashboard unavailable</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#214a39]">We couldn&apos;t load your dashboard.</h1>
          <p className="mt-2 text-sm text-[#74877f]">{error}</p>
        </CardContent>
      </Card>
    </div>
  );

  if (!canViewPractice) {
    const shortcuts = [
      { href: '/patients', label: 'Patients', description: 'Open patient records', permission: 'patient:read' },
      { href: '/appointments', label: 'Appointments', description: 'View the appointment schedule', permission: 'appointment:read' },
      { href: '/exercise-plans', label: 'Exercise plans', description: 'Prepare patient exercise programmes', permission: 'patient:read' },
    ].filter((item) => hasPermission(user, item.permission));

    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="rounded-3xl bg-[#1d624b] px-6 py-8 text-white sm:px-9">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#c5ddcd]">Your workspace</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Welcome, {user?.firstName || 'there'}.</h1>
          <p className="mt-2 text-sm text-[#c5ddcd]">{profile?.jobTitle || user?.role?.replace(/_/g, ' ') || 'Clinic team member'}{profile?.department ? ` · ${profile.department}` : ''}</p>
        </section>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="rounded-2xl border-[#e7eee8] bg-white shadow-sm">
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">Signed in as</p>
              <p className="mt-1 font-medium">{user?.email}</p>
              {profile?.phone && <p className="mt-1 text-sm text-muted-foreground">{profile.phone}</p>}
              <Link href="/profile" className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[#2e6d4d] hover:underline">Edit my profile <ArrowRight className="h-4 w-4" /></Link>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-[#e7eee8] bg-white shadow-sm">
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">Clinic</p>
              <p className="mt-1 font-medium">{user?.tenant?.name || 'PhysioCore'}</p>
              <p className="mt-1 text-sm text-muted-foreground">Currency: {currency}</p>
            </CardContent>
          </Card>
        </div>
        <section>
          <h2 className="mb-3 text-lg font-semibold text-[#214a39]">Your tools</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shortcuts.map((item) => (
              <Link key={item.href} href={item.href} className="rounded-2xl border border-[#e7eee8] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <p className="font-semibold text-[#214a39]">{item.label}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    );
  }

  const d = data!;

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-10">
      <section className="relative isolate overflow-hidden rounded-[1.75rem] bg-[#1d624b] px-6 py-7 text-white shadow-[0_24px_60px_-34px_rgba(27,76,53,0.6)] sm:px-9 sm:py-9">
        <div className="pointer-events-none absolute right-[-5rem] top-[-8rem] z-0 h-80 w-80 rounded-full border border-white/10" />
        <div className="pointer-events-none absolute right-16 top-10 z-0 h-48 w-48 rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -bottom-36 left-1/3 z-0 h-72 w-72 rounded-full bg-[#3b8961]/25 blur-3xl" />
        <div className="relative z-10 flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-[#d0e8d7]">
              <Sparkles className="h-3.5 w-3.5" /> YOUR PRACTICE AT A GLANCE
            </div>
            <h1 className="mt-5 text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">Your practice, in rhythm.</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[#c5ddcd] sm:text-base">
              A clearer view of your patients, your team, and the day ahead — all in one place.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/appointments" className="inline-flex items-center gap-2 rounded-full bg-[#f4f7ed] px-5 py-3 text-sm font-semibold text-[#22543f] transition hover:-translate-y-0.5 hover:bg-white">
              <CalendarDays className="h-4 w-4" /> View schedule <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/patients" className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15">
              <UsersRound className="h-4 w-4" /> Patients
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="practice-pulse-heading">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#679276]">The big picture</p>
            <h2 id="practice-pulse-heading" className="mt-1 text-xl font-semibold tracking-tight text-[#214a39]">Practice pulse</h2>
          </div>
          <p className="text-sm text-[#82948c]">Your key numbers, all together</p>
        </div>
        <DashboardMetrics
          totalPatients={d.metrics.totalPatients.toLocaleString()}
          todayAppointments={d.metrics.todayAppointments.toString()}
          revenueThisMonth={formatCurrency(d.metrics.revenueThisMonth, currency)}
          outstandingInvoices={formatCurrency(d.metrics.outstandingInvoices, currency)}
          noShowRate={d.metrics.noShowRate}
          therapistUtilisation={d.metrics.therapistUtilisation}
        />
      </section>

      <section aria-label="Care team tasks" className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-[1.5rem] border-[#e7eee8] bg-white shadow-sm">
          <CardContent className="flex items-center gap-4 p-5 sm:p-6">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#fbf0df] text-[#b87928]">
              <Bell className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-medium text-[#74877f]">Pending follow-ups</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-[#214a39]">{followUpStats?.pending ?? '-'}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-[1.5rem] border-[#e7eee8] bg-white shadow-sm">
          <CardContent className="flex items-center gap-4 p-5 sm:p-6">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#e8f4eb] text-[#438262]">
              <ClipboardList className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-medium text-[#74877f]">Active treatment plans</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-[#214a39]">{treatmentPlans?.total ?? '-'}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-[1.5rem] border-[#e7eee8] bg-white shadow-sm">
          <CardContent className="flex items-center gap-4 p-5 sm:p-6">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#edf0fc] text-[#6874ba]">
              <CheckSquare className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-medium text-[#74877f]">Pending client tasks</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-[#214a39]">{taskStats?.pending ?? '-'}</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <RevenueChart data={d.revenueTrend} currency={currency} />
        <AppointmentsChart data={d.appointmentsByType} />
      </div>

      <Card className="overflow-hidden rounded-[1.5rem] border-[#e7eee8] bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-4 px-5 py-5 sm:px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#679276]">Your day</p>
            <CardTitle className="mt-1 text-lg font-semibold tracking-tight text-[#214a39]">Today&apos;s appointments</CardTitle>
          </div>
          <Link href="/appointments" className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[#dce9df] px-4 py-2 text-xs font-semibold text-[#438262] transition hover:bg-[#f4f8f3]">
            Full schedule <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </CardHeader>
        <CardContent className="px-0 pb-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5 text-xs font-semibold uppercase tracking-wide text-[#82948c] sm:pl-6">Time</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-[#82948c]">Patient</TableHead>
                <TableHead className="hidden text-xs font-semibold uppercase tracking-wide text-[#82948c] sm:table-cell">Therapist</TableHead>
                <TableHead className="hidden text-xs font-semibold uppercase tracking-wide text-[#82948c] md:table-cell">Type</TableHead>
                <TableHead className="pr-5 text-xs font-semibold uppercase tracking-wide text-[#82948c] sm:pr-6">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.todayAppts.map((apt) => (
                <TableRow key={apt.id} className="border-[#eff3ef] hover:bg-[#f8faf7]">
                  <TableCell className="pl-5 font-semibold text-[#315848] sm:pl-6">{apt.time}</TableCell>
                  <TableCell className="font-medium text-[#426354]">{apt.patient}</TableCell>
                  <TableCell className="hidden text-[#74877f] sm:table-cell">{apt.therapist}</TableCell>
                  <TableCell className="hidden text-[#74877f] md:table-cell">{apt.type}</TableCell>
                  <TableCell className="pr-5 sm:pr-6">
                    <Badge variant={
                      apt.status === 'CONFIRMED' ? 'success' :
                      apt.status === 'SCHEDULED' ? 'info' :
                      apt.status === 'IN_SESSION' ? 'warning' : 'neutral'
                    }>
                      {apt.status.replace(/_/g, ' ')}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {d.todayAppts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center">
                    <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eef5ef] text-[#58906c]"><CalendarDays className="h-5 w-5" /></span>
                    <p className="mt-3 text-sm font-semibold text-[#426354]">A little breathing room</p>
                    <p className="mt-1 text-xs text-[#8b9b93]">There are no appointments scheduled for today.</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
