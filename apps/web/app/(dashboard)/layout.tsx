'use client';

import { Sidebar } from '@/components/sidebar';
import { useAuth } from '@/contexts/auth-context';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { AccessDenied } from '@/components/access-denied';
import { hasPermission, permissionForDashboardPath } from '@/lib/permissions';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const requiredPermission = permissionForDashboardPath(pathname);

  useEffect(() => {
    if (!loading && user?.role === 'PATIENT' && pathname === '/dashboard') {
      router.replace('/portal');
      return;
    }
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [loading, isAuthenticated, pathname, router, user?.role]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f3f7f2]">
        <Loader2 className="h-8 w-8 animate-spin text-[#438262]" />
      </div>
    );
  }

  if (!isAuthenticated) return null;
  if (user?.role === 'PATIENT' && pathname === '/dashboard') return null;

  if (requiredPermission && !hasPermission(user, requiredPermission)) {
    return (
      <AccessDenied
        canViewDashboard={hasPermission(user, 'finance:read')}
        homeHref={user?.role === 'PATIENT' ? '/portal' : undefined}
        homeLabel={user?.role === 'PATIENT' ? 'My portal' : 'Dashboard'}
      />
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-[#f3f7f2]">
        <div className="p-5 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
