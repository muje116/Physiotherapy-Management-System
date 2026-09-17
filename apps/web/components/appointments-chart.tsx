'use client';

import type { ComponentType } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const CompatibleBarChart = BarChart as unknown as ComponentType<any>;
const CompatibleBar = Bar as unknown as ComponentType<any>;
const CompatibleXAxis = XAxis as unknown as ComponentType<any>;
const CompatibleYAxis = YAxis as unknown as ComponentType<any>;
const CompatibleCartesianGrid = CartesianGrid as unknown as ComponentType<any>;
const CompatibleTooltip = Tooltip as unknown as ComponentType<any>;
const CompatibleResponsiveContainer = ResponsiveContainer as unknown as ComponentType<any>;

interface AppointmentTypeData {
  type: string;
  count: number;
}

interface AppointmentsChartProps {
  data?: AppointmentTypeData[];
}

const defaultData: AppointmentTypeData[] = [
  { type: 'Initial Assessment', count: 85 },
  { type: 'Follow-up', count: 220 },
  { type: 'Manual Therapy', count: 150 },
  { type: 'Exercise Rehab', count: 180 },
  { type: 'Dry Needling', count: 95 },
  { type: 'Sports Massage', count: 70 },
];

export function AppointmentsChart({ data = defaultData }: AppointmentsChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Appointments by Type</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <CompatibleResponsiveContainer width="100%" height="100%">
            <CompatibleBarChart data={data} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
              <CompatibleCartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <CompatibleXAxis dataKey="type" className="text-xs text-muted-foreground" tickLine={false} />
              <CompatibleYAxis className="text-xs text-muted-foreground" tickLine={false} />
              <CompatibleTooltip
                contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
              />
              <CompatibleBar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </CompatibleBarChart>
          </CompatibleResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
