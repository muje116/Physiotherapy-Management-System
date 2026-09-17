export interface AnalyticsEvent {
  event: string;
  userId: string;
  tenantId: string;
  properties?: Record<string, any>;
  timestamp?: Date;
}

const events: AnalyticsEvent[] = [];

export function trackEvent(event: AnalyticsEvent): void {
  events.push({ ...event, timestamp: event.timestamp || new Date() });

  if (process.env.ANALYTICS_WEBHOOK_URL) {
    fetch(process.env.ANALYTICS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    }).catch(() => {});
  }
}

export function getTrackedEvents(
  filters?: { event?: string; userId?: string; tenantId?: string; since?: Date }
): AnalyticsEvent[] {
  let filtered = [...events];
  if (filters?.event) filtered = filtered.filter(e => e.event === filters.event);
  if (filters?.userId) filtered = filtered.filter(e => e.userId === filters.userId);
  if (filters?.tenantId) filtered = filtered.filter(e => e.tenantId === filters.tenantId);
  if (filters?.since) filtered = filtered.filter(e => e.timestamp && e.timestamp >= filters.since!);
  return filtered;
}
