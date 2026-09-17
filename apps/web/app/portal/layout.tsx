'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { HeartPulse, LogOut, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/auth-context';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const { logout, user, isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [loading, isAuthenticated, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b bg-white">
        <div className="flex items-center justify-between px-6 h-14">
          <Link href="/portal" className="flex items-center gap-2">
            <HeartPulse className="h-6 w-6 text-primary" />
            <span className="font-semibold text-base">My Portal</span>
          </Link>
          <div className="flex items-center gap-3">
            {user && (
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {user.firstName} {user.lastName}
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut className="h-4 w-4 mr-2" /> Log Out
            </Button>
          </div>
        </div>
      </header>
      <main className="p-6 max-w-5xl mx-auto">{children}</main>
    </div>
  );
}
