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

export function RevenueChart({ data = defaultData }: RevenueChartProps) {
  const formatCurrency = (value: number) => `R ${(value / 1000).toFixed(0)}k`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Revenue Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <CompatibleResponsiveContainer width="100%" height="100%">
            <CompatibleLineChart data={data} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
              <CompatibleCartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <CompatibleXAxis dataKey="month" className="text-xs text-muted-foreground" tickLine={false} />
              <CompatibleYAxis tickFormatter={formatCurrency} className="text-xs text-muted-foreground" tickLine={false} />
              <CompatibleTooltip
                formatter={(value: number) => [`R ${value.toLocaleString()}`, 'Revenue']}
                contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
              />
              <CompatibleLine type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            </CompatibleLineChart>
          </CompatibleResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
