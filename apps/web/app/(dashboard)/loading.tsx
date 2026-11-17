import { Loader2 } from 'lucide-react';

export default function DashboardLoading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-sm text-muted-foreground" role="status" aria-live="polite">
      <Loader2 className="h-8 w-8 animate-spin text-[#438262]" aria-hidden="true" />
      <span>Loading your workspace…</span>
    </div>
  );
}
