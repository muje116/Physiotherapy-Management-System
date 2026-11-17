'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getApiErrorMessage } from '@/lib/api';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Unhandled application error', error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/20 p-6">
      <div role="alert" className="w-full max-w-lg space-y-4 rounded-lg border bg-background p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-6 w-6" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {getApiErrorMessage(error, 'This page could not be displayed. Please try again.')}
          </p>
        </div>
        <Button type="button" onClick={() => reset()}>Try again</Button>
      </div>
    </div>
  );
}
