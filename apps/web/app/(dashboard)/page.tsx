'use client';

import { useEffect, useState } from 'react';
import { DashboardMetrics } from '@/components/dashboard-metrics';
import { RevenueChart } from '@/components/revenue-chart';
import { AppointmentsChart } from '@/components/appointments-chart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Bell, ClipboardList, CheckSquare } from 'lucide-react';
import api from '@/lib/api';

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
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [followUpStats, setFollowUpStats] = useState<FollowUpStats | null>(null);
  const [treatmentPlans, setTreatmentPlans] = useState<TreatmentPlanInfo | null>(null);
  const [taskStats, setTaskStats] = useState<ClientTaskStats | null>(null);

  useEffect(() => {
    Promise.all([
      api.get('/reports/dashboard'),
      api.get('/notifications/follow-ups/stats').catch(() => ({ data: { data: null } })),
      api.get('/treatment-plans?status=ACTIVE').catch(() => ({ data: { data: null } })),
      api.get('/client-tasks/stats').catch(() => ({ data: { data: null } })),
    ]).then(([dashRes, fupRes, tpRes, ctRes]) => {
      setData(dashRes.data.data);
      setFollowUpStats(fupRes.data.data);
      setTreatmentPlans(tpRes.data.data);
      setTaskStats(ctRes.data.data);
    }).catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1,2,3,4,5,6,7,8,9].map(i => <Skeleton key={i} className="h-28" />)}
      </div>
    </div>
  );
  if (error) return <div className="p-6 text-red-500">Error: {error}</div>;

  const d = data!;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back. Here is your practice overview.</p>
      </div>

      <DashboardMetrics
        totalPatients={d.metrics.totalPatients.toLocaleString()}
        todayAppointments={d.metrics.todayAppointments.toString()}
        revenueThisMonth={`R ${d.metrics.revenueThisMonth.toLocaleString()}`}
        outstandingInvoices={`R ${d.metrics.outstandingInvoices.toLocaleString()}`}
        noShowRate={d.metrics.noShowRate}
        therapistUtilisation={d.metrics.therapistUtilisation}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Follow-ups</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{followUpStats?.pending ?? '-'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Treatment Plans</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{treatmentPlans?.total ?? '-'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Client Tasks</CardTitle>
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{taskStats?.pending ?? '-'}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <RevenueChart data={d.revenueTrend} />
        <AppointmentsChart data={d.appointmentsByType} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Today's Appointments</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Therapist</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.todayAppts.map((apt) => (
                <TableRow key={apt.id}>
                  <TableCell className="font-medium">{apt.time}</TableCell>
                  <TableCell>{apt.patient}</TableCell>
                  <TableCell>{apt.therapist}</TableCell>
                  <TableCell>{apt.type}</TableCell>
                  <TableCell>
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
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No appointments today</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
