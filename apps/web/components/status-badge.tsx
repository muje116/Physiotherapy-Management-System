'use client';

import { Badge } from '@/components/ui/badge';

const STATUS_COLORS: Record<string, 'success' | 'warning' | 'info' | 'destructive' | 'cancelled' | 'neutral' | 'secondary'> = {
  ACTIVE: 'success',
  INACTIVE: 'neutral',
  SCHEDULED: 'info',
  CONFIRMED: 'success',
  CHECKED_IN: 'warning',
  IN_SESSION: 'warning',
  COMPLETED: 'neutral',
  CANCELLED: 'cancelled',
  NO_SHOW: 'destructive',
  PAID: 'success',
  UNPAID: 'warning',
  OVERDUE: 'destructive',
  PENDING: 'info',
  SENT: 'success',
  DRAFT: 'secondary',
  SIGNED: 'success',
  UNSIGNED: 'warning',
  AVAILABLE: 'success',
  LOW_STOCK: 'warning',
  EXPIRED: 'destructive',
  IN_SERVICE: 'success',
  MAINTENANCE: 'warning',
  RETIRED: 'neutral',
  LOST: 'destructive',
};

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const variant = STATUS_COLORS[status] || 'secondary';
  return <Badge variant={variant}>{status.replace(/_/g, ' ')}</Badge>;
}
