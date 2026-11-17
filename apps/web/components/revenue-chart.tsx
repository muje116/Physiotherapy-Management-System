'use client';

import type { ComponentType } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const CompatibleLineChart = LineChart as unknown as ComponentType<any>;
const CompatibleLine = Line as unknown as ComponentType<any>;
const CompatibleXAxis = XAxis as unknown as ComponentType<any>;
const CompatibleYAxis = YAxis as unknown as ComponentType<any>;
const CompatibleCartesianGrid = CartesianGrid as unknown as ComponentType<any>;
const CompatibleTooltip = Tooltip as unknown as ComponentType<any>;
const CompatibleResponsiveContainer = ResponsiveContainer as unknown as ComponentType<any>;

interface RevenueDataPoint {
  month: string;
  revenue: number;
}

interface RevenueChartProps {
  data?: RevenueDataPoint[];
  currency?: string;
}

const defaultData: RevenueDataPoint[] = [
  { month: 'Jul', revenue: 210000 },
  { month: 'Aug', revenue: 245000 },
  { month: 'Sep', revenue: 232000 },
  { month: 'Oct', revenue: 278000 },
  { month: 'Nov', revenue: 290000 },
  { month: 'Dec', revenue: 262000 },
  { month: 'Jan', revenue: 275000 },
  { month: 'Feb', revenue: 268000 },
  { month: 'Mar', revenue: 284500 },
  { month: 'Apr', revenue: 295000 },
  { month: 'May', revenue: 310000 },
  { month: 'Jun', revenue: 298000 },
];

export function RevenueChart({ data = defaultData, currency = 'ZAR' }: RevenueChartProps) {
  const formatCurrency = (value: number) => {
    try { return new Intl.NumberFormat(undefined, { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 0 }).format(value); }
    catch { return `${currency} ${(value / 1000).toFixed(0)}k`; }
  };

  return (
    <Card className="rounded-[1.5rem] border-[#e7eee8] bg-white shadow-sm">
      <CardHeader className="px-5 pb-2 pt-5 sm:px-6 sm:pt-6">
        <CardTitle className="text-base font-semibold text-[#214a39]">Revenue Trend</CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-5 sm:px-5 sm:pb-6">
        <div className="h-[280px]">
          <CompatibleResponsiveContainer width="100%" height="100%">
            <CompatibleLineChart data={data} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
              <CompatibleCartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <CompatibleXAxis dataKey="month" className="text-xs text-muted-foreground" tickLine={false} />
              <CompatibleYAxis tickFormatter={formatCurrency} className="text-xs text-muted-foreground" tickLine={false} />
              <CompatibleTooltip
                formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                contentStyle={{ borderRadius: '14px', border: '1px solid #e1ebe2', boxShadow: '0 12px 30px -18px rgba(25, 68, 46, 0.35)' }}
              />
              <CompatibleLine type="monotone" dataKey="revenue" stroke="#438262" strokeWidth={3} dot={{ r: 4, fill: '#438262', strokeWidth: 0 }} activeDot={{ r: 6, fill: '#1d624b' }} />
            </CompatibleLineChart>
          </CompatibleResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
