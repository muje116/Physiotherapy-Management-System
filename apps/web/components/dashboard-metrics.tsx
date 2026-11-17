'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Users, Calendar, DollarSign, Receipt, XCircle, Activity } from 'lucide-react';

interface MetricProps {
  title: string;
  value: string;
  trend: string;
  trendUp?: boolean;
  icon: React.ReactNode;
  iconClass: string;
}

function MetricCard({ title, value, trend, trendUp = true, icon, iconClass }: MetricProps) {
  return (
    <Card className="group relative overflow-hidden rounded-[1.5rem] border-[#e7eee8] bg-white shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#305b43]/5">
      <div className="absolute -right-7 -top-8 h-24 w-24 rounded-full bg-[#f7faf6] transition group-hover:scale-125" />
      <CardContent className="relative p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-[#74877f]">{title}</p>
            <p className="text-2xl font-semibold tracking-tight text-[#214a39] sm:text-[1.8rem]">{value}</p>
          </div>
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${iconClass}`}>
            {icon}
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 text-xs">
          <span className={`rounded-full px-2 py-1 font-semibold ${trendUp ? 'bg-[#eaf5ed] text-[#3d805c]' : 'bg-[#fbefec] text-[#b65b4c]'}`}>
            {trend}
          </span>
          <span className="text-[#96a59e]">vs last month</span>
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
  revenueThisMonth = '—',
  outstandingInvoices = '—',
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
        iconClass="bg-[#e8f4eb] text-[#438262]"
      />
      <MetricCard
        title="Today's Appointments"
        value={todayAppointments}
        trend="+8%"
        icon={<Calendar className="h-5 w-5" />}
        iconClass="bg-[#edf0fc] text-[#6874ba]"
      />
      <MetricCard
        title="Revenue This Month"
        value={revenueThisMonth}
        trend="+15%"
        icon={<DollarSign className="h-5 w-5" />}
        iconClass="bg-[#fbf0df] text-[#b87928]"
      />
      <MetricCard
        title="Outstanding Invoices"
        value={outstandingInvoices}
        trend="-5%"
        trendUp={false}
        icon={<Receipt className="h-5 w-5" />}
        iconClass="bg-[#f8ece8] text-[#b86c54]"
      />
      <MetricCard
        title="No-Show Rate"
        value={noShowRate}
        trend="-0.8%"
        icon={<XCircle className="h-5 w-5" />}
        iconClass="bg-[#f2edf8] text-[#8267a5]"
      />
      <MetricCard
        title="Therapist Utilisation"
        value={therapistUtilisation}
        trend="+3%"
        icon={<Activity className="h-5 w-5" />}
        iconClass="bg-[#e7f2f4] text-[#46818a]"
      />
    </div>
  );
}
