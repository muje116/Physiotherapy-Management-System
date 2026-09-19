'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  Calendar,
  Stethoscope,
  FileText,
  Receipt,
  Dumbbell,
  Megaphone,
  BarChart3,
  Settings,
  HeartPulse,
  ChevronLeft,
  Menu,
  LogOut,
  Bell,
  CreditCard,
  Building2,
  ClipboardList,
  CheckSquare,
  Package,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/patients', label: 'Patients', icon: Users },
  { href: '/appointments', label: 'Appointments', icon: Calendar },
  { href: '/therapists', label: 'Therapists', icon: Stethoscope },
  { href: '/soap-notes', label: 'SOAP Notes', icon: FileText },
  { href: '/invoices', label: 'Invoices', icon: Receipt },
  { href: '/exercise-plans', label: 'Exercise Plans', icon: Dumbbell },
  { href: '/marketing', label: 'Marketing', icon: Megaphone },
  { href: '/notifications', label: 'Notifications', icon: Bell },
  { href: '/payments', label: 'Payments', icon: CreditCard },
  { href: '/medical-schemes', label: 'Medical Schemes', icon: Building2 },
  { href: '/treatment-plans', label: 'Treatment Plans', icon: ClipboardList },
  { href: '/client-tasks', label: 'Client Tasks', icon: CheckSquare },
  { href: '/inventory', label: 'Inventory & Assets', icon: Package },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/users', label: 'Hospital Employees', icon: Users },
  { href: '/reminders', label: 'Reminders', icon: Bell },
];

function SidebarNav({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 space-y-1 px-3 py-4">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary/10 text-primary'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground'
            )}
            title={collapsed ? item.label : undefined}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const initials = user ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}` : 'DR';
  const displayName = user ? `Dr. ${user.firstName} ${user.lastName}` : 'Dr. Sarah Wilson';
  const displayEmail = user?.email || 'user@physiocore.com';

  return (
    <>
      <aside
        className={cn(
          'hidden md:flex flex-col bg-sidebar text-sidebar-foreground transition-all duration-300',
          collapsed ? 'w-16' : 'w-60'
        )}
      >
        <div className={cn('flex h-14 items-center border-b border-sidebar-foreground/10 px-4', collapsed && 'justify-center')}>
          {!collapsed && (
            <div className="flex items-center gap-2">
              <HeartPulse className="h-6 w-6 text-primary" />
              <span className="font-semibold text-base">PhysioCore</span>
            </div>
          )}
          {collapsed && <HeartPulse className="h-6 w-6 text-primary" />}
          <Button
            variant="ghost"
            size="icon"
            className={cn('ml-auto h-8 w-8 text-sidebar-foreground/70', collapsed && 'ml-0')}
            onClick={() => setCollapsed(!collapsed)}
          >
            <ChevronLeft className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')} />
          </Button>
        </div>
        <SidebarNav collapsed={collapsed} />
        <div className={cn('border-t border-sidebar-foreground/10 p-4', collapsed && 'flex justify-center')}>
          {!collapsed ? (
            <div className="flex items-center gap-3">
              <Avatar fallback={initials} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{displayName}</p>
                <p className="text-xs text-sidebar-foreground/60 truncate">{displayEmail}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-sidebar-foreground/60 hover:text-sidebar-foreground" onClick={logout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Avatar fallback={initials} size="sm" />
          )}
        </div>
      </aside>

      <Sheet>
        <SheetTrigger>
          <Button variant="ghost" size="icon" className="md:hidden h-9 w-9">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-60">
          <div className="flex h-14 items-center border-b px-4">
            <div className="flex items-center gap-2">
              <HeartPulse className="h-6 w-6 text-primary" />
              <span className="font-semibold text-base">PhysioCore</span>
            </div>
          </div>
          <SidebarNav />
          <div className="absolute bottom-0 left-0 right-0 border-t p-4">
            <div className="flex items-center gap-3">
              <Avatar fallback={initials} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{displayName}</p>
                <p className="text-xs text-muted-foreground truncate">{displayEmail}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={logout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
