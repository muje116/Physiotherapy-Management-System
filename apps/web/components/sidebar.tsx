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
  CircleUserRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { DashboardPermission, hasPermission } from '@/lib/permissions';

const navGroups: Array<{ label: string; items: Array<{ href: string; label: string; icon: typeof LayoutDashboard; permission: DashboardPermission }> }> = [
  { label: 'Workspace', items: [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'finance:read' },
  ] },
  { label: 'Clinical care', items: [
    { href: '/patients', label: 'Patients', icon: Users, permission: 'patient:read' },
    { href: '/appointments', label: 'Appointments', icon: Calendar, permission: 'appointment:read' },
    { href: '/therapists', label: 'Therapists', icon: Stethoscope, permission: 'patient:read' },
    { href: '/soap-notes', label: 'SOAP Notes', icon: FileText, permission: 'soap_note:read' },
    { href: '/exercise-plans', label: 'Exercise Plans', icon: Dumbbell, permission: 'patient:read' },
    { href: '/treatment-plans', label: 'Treatment Plans', icon: ClipboardList, permission: 'treatment:read' },
    { href: '/client-tasks', label: 'Client Tasks', icon: CheckSquare, permission: 'client_task:read' },
  ] },
  { label: 'Finance', items: [
    { href: '/invoices', label: 'Invoices', icon: Receipt, permission: 'finance:read' },
    { href: '/payments', label: 'Payments', icon: CreditCard, permission: 'payment:read' },
    { href: '/medical-schemes', label: 'Medical Schemes', icon: Building2, permission: 'scheme:read' },
    { href: '/reports', label: 'Reports', icon: BarChart3, permission: 'finance:read' },
  ] },
  { label: 'Operations', items: [
    { href: '/inventory', label: 'Inventory & Assets', icon: Package, permission: 'inventory:read' },
    { href: '/notifications', label: 'Notifications', icon: Bell, permission: 'notification:read' },
    { href: '/reminders', label: 'Reminders', icon: Bell, permission: 'settings:read' },
    { href: '/marketing', label: 'Marketing', icon: Megaphone, permission: 'settings:read' },
  ] },
  { label: 'Administration', items: [
    { href: '/users', label: 'Hospital Employees', icon: Users, permission: 'settings:read' },
    { href: '/settings', label: 'Settings', icon: Settings, permission: 'settings:read' },
  ] },
];

function SidebarNav({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
      {navGroups.map((group) => {
        const visibleItems = group.items.filter((item) => item.href === '/dashboard' || hasPermission(user, item.permission));
        if (!visibleItems.length) return null;
        return (
          <section key={group.label} className="space-y-1">
            {!collapsed && <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/45">{group.label}</p>}
            {visibleItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link key={item.href} href={item.href} className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive ? 'bg-white/10 text-[#d7f0dd] ring-1 ring-inset ring-white/10' : 'text-sidebar-foreground/70 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground'
                )} title={collapsed ? item.label : undefined}>
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </section>
        );
      })}
    </nav>
  );
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const initials = user ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}` : 'DR';
  const displayName = user ? `${user.firstName} ${user.lastName}` : 'PhysioCore user';
  const displayEmail = user?.email || 'user@physiocore.com';
  const brandName = user?.tenant?.name || 'PhysioCore';
  const logoUrl = user?.tenant?.logoUrl;

  const BrandMark = ({ dark = false }: { dark?: boolean }) => logoUrl
    ? <img src={logoUrl} alt="" className="h-7 w-7 rounded-md object-contain" />
    : <HeartPulse className={cn('h-6 w-6', dark ? 'text-[#1d624b]' : 'text-[#aad9b7]')} />;

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
              <BrandMark />
              <span className="truncate font-semibold text-base">{brandName}</span>
            </div>
          )}
          {collapsed && <BrandMark />}
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
                <Link href="/profile" className="block truncate text-sm font-medium hover:underline">{displayName}</Link>
                <p className="text-xs text-sidebar-foreground/60 truncate">{displayEmail}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-sidebar-foreground/60 hover:text-sidebar-foreground" onClick={logout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Link href="/profile" title="My profile"><Avatar fallback={initials} size="sm" /></Link>
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
              <BrandMark dark />
              <span className="truncate font-semibold text-base">{brandName}</span>
            </div>
          </div>
          <SidebarNav />
          <div className="absolute bottom-0 left-0 right-0 border-t p-4">
            <div className="flex items-center gap-3">
              <Avatar fallback={initials} size="sm" />
              <div className="flex-1 min-w-0">
                <Link href="/profile" className="block truncate text-sm font-medium hover:underline">{displayName}</Link>
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
