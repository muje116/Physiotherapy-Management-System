'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Users, Calendar, DollarSign, Receipt, XCircle, Activity } from 'lucide-react';

interface MetricProps {
  title: string;
  value: string;
  trend: string;
  trendUp?: boolean;
  icon: React.ReactNode;
}

function MetricCard({ title, value, trend, trendUp = true, icon }: MetricProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            {icon}
          </div>
        </div>
        <div className="mt-3 flex items-center text-xs">
          <span className={trendUp ? 'text-green-600' : 'text-red-600'}>
            {trend}
          </span>
          <span className="text-muted-foreground ml-1">vs last month</span>
        </div>
      </CardContent>
    </Card>
  );
}

interface DashboardMetricsProps {
  totalPatients?: string;
  todayAppointments?: string;
  revenueThisMonth?: string;
  outstandingInvoices?: string;
  noShowRate?: string;
  therapistUtilisation?: string;
}

export function DashboardMetrics({
  totalPatients = '1,284',
  todayAppointments = '48',
  revenueThisMonth = 'R 284,500',
  outstandingInvoices = 'R 42,300',
  noShowRate = '4.2%',
  therapistUtilisation = '78%',
}: DashboardMetricsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <MetricCard
        title="Total Patients"
        value={totalPatients}
        trend="+12%"
        icon={<Users className="h-5 w-5" />}
      />
      <MetricCard
        title="Today's Appointments"
        value={todayAppointments}
        trend="+8%"
        icon={<Calendar className="h-5 w-5" />}
      />
      <MetricCard
        title="Revenue This Month"
        value={revenueThisMonth}
        trend="+15%"
        icon={<DollarSign className="h-5 w-5" />}
      />
      <MetricCard
        title="Outstanding Invoices"
        value={outstandingInvoices}
        trend="-5%"
        trendUp={false}
        icon={<Receipt className="h-5 w-5" />}
      />
      <MetricCard
        title="No-Show Rate"
        value={noShowRate}
        trend="-0.8%"
        icon={<XCircle className="h-5 w-5" />}
      />
      <MetricCard
        title="Therapist Utilisation"
        value={therapistUtilisation}
        trend="+3%"
        icon={<Activity className="h-5 w-5" />}
      />
    </div>
  );
}
