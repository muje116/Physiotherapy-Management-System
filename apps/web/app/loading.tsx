import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-live="polite">
      <span className="sr-only">Loading page</span>
      <Loader2 className="h-8 w-8 animate-spin text-[#438262]" aria-hidden="true" />
    </div>
  );
}
