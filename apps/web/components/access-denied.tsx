'use client';

import Link from 'next/link';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function AccessDenied({ canViewDashboard = false, homeHref, homeLabel = 'Dashboard' }: { canViewDashboard?: boolean; homeHref?: string; homeLabel?: string }) {
  const destination = homeHref || (canViewDashboard ? '/dashboard' : null);

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <div className="max-w-md space-y-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <ShieldAlert className="h-6 w-6" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Access denied</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your role does not have permission to view this module. If you need access, contact a practice administrator.
          </p>
        </div>
        <div className="flex justify-center gap-2">
          <Button type="button" variant="outline" onClick={() => window.history.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Go back
          </Button>
          {destination && (
            <Link href={destination} className={cn(buttonVariants({ variant: 'default' }))}>
              {homeLabel}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
