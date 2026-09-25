'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '../store/authStore';
import { useSubscriptionStore } from '../store/subscriptionStore';
import {
  LayoutDashboard,
  Receipt,
  ShoppingBag,
  Users,
  Package,
  CreditCard,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  User as UserIcon,
  Building,
  Sparkles,
  Zap,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import ThemeToggle from './ThemeToggle';

export default function SidebarLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { planStatus, fetchPlanStatus, openUpgradeModal } = useSubscriptionStore();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (user?.role !== 'SUPER_ADMIN') {
      fetchPlanStatus();
    }
  }, [user?.role, fetchPlanStatus]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Create Invoice', href: '/billing', icon: Receipt, featureKey: 'billingEnabled' as const },
    { name: 'Purchase Invoices', href: '/purchases', icon: ShoppingBag, featureKey: 'purchasesEnabled' as const },
    { name: 'Customers', href: '/customers', icon: Users },
    { name: 'Products & Inventory', href: '/products', icon: Package, featureKey: 'productsEnabled' as const },
    { name: 'Payments', href: '/payments', icon: CreditCard, featureKey: 'paymentsEnabled' as const },
    { name: 'Reports', href: '/reports', icon: BarChart3, featureKey: 'reportsEnabled' as const },
    { name: 'Business Settings', href: '/business', icon: Settings },
  ];

  // Only show modules enabled on the tenant's plan (Super Admin sees all)
  const visibleNavItems = navItems.filter((item) => {
    if (user?.role === 'SUPER_ADMIN') return true;
    if (!item.featureKey) return true;
    return user?.tenant?.[item.featureKey] !== false;
  });

  return (
    <div className="flex min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/30 backdrop-blur-md sticky top-0 h-screen p-4 justify-between no-print z-20">
        <div className="flex flex-col gap-8">
          {/* Logo / Title */}
          <div className="flex items-center gap-3 px-2 py-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-zinc-950 font-bold text-lg shadow-sm">
              B
            </div>
            <div>
              <h1 className="font-bold tracking-tight text-zinc-900 dark:text-white">BillNova</h1>
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">ERP Platform</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-1.5">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20 font-semibold shadow-xs'
                      : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800/30 border border-transparent'
                  }`}
                >
                  <Icon className={`h-4.5 w-4.5 ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-500'}`} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Card & Logout */}
        <div className="flex flex-col gap-3 border-t border-zinc-200 dark:border-zinc-800/80 pt-4 pb-6">
          <div className="flex items-center gap-3 px-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
              <UserIcon className="h-4 w-4" />
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-zinc-900 dark:text-white truncate">{user?.name || 'User'}</p>
              <p className="text-[10px] text-zinc-500 font-semibold tracking-wider uppercase truncate">{user?.role || 'Staff'}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:text-rose-700 dark:hover:text-rose-300 transition duration-150"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Drawer Trigger & Navbar */}
      <div className="flex flex-col flex-1 min-w-0">
        <header className="flex md:hidden items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/30 backdrop-blur-md sticky top-0 z-40 no-print">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-zinc-950 font-bold text-md">
              B
            </div>
            <h1 className="font-bold tracking-tight text-white text-sm">BillNova</h1>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white"
            >
              {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </header>

        {/* Mobile Navigation Drawer */}
        {mobileOpen && (
          <div className="md:hidden fixed inset-0 z-30 flex">
            {/* Overlay */}
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
            
            <aside className="relative flex w-64 flex-col bg-zinc-900 border-r border-zinc-800 p-4 justify-between h-full z-40">
              <div className="flex flex-col gap-8">
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500 text-zinc-950 font-bold text-md">
                      B
                    </div>
                    <span className="font-bold text-white">BillNova</span>
                  </div>
                  <button onClick={() => setMobileOpen(false)} className="text-zinc-500 hover:text-white">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <nav className="flex flex-col gap-1">
                  {visibleNavItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                          isActive
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                        }`}
                      >
                        <Icon className="h-4.5 w-4.5" />
                        {item.name}
                      </Link>
                    );
                  })}
                </nav>
              </div>

              <div className="flex flex-col gap-4 border-t border-zinc-850 pt-4">
                <div className="flex items-center gap-3 px-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-zinc-300">
                    <UserIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white truncate">{user?.name}</p>
                    <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-semibold">{user?.role}</p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 transition"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            </aside>
          </div>
        )}

        {/* Header (Desktop only) */}
        <header className="hidden md:flex items-center justify-between px-8 py-3.5 border-b border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/40 backdrop-blur-md sticky top-0 z-30 no-print shadow-xs">
          <div className="flex items-center gap-3">
            {user?.tenant?.logoUrl ? (
              <img
                src={user.tenant.logoUrl}
                alt="Business Logo"
                className="h-7 w-7 rounded-lg object-contain bg-white border border-zinc-200 dark:border-zinc-800 p-0.5 shrink-0"
              />
            ) : (
              <Building className="h-5 w-5 text-emerald-500" />
            )}
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{user?.tenant?.name || 'Loading Business...'}</h2>
            {user?.tenant?.gstin && (
              <span className="ml-2 rounded-full bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase border border-emerald-200 dark:border-emerald-500/20">
                GST: {user.tenant.gstin}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Plan Status Widget */}
            {user?.role === 'SUPER_ADMIN' ? (
              <span className="rounded-full bg-purple-500/10 px-3 py-1 text-xs font-bold text-purple-400 border border-purple-500/20">
                Super Admin
              </span>
            ) : planStatus?.plan === 'BASIC' || user?.tenant?.plan === 'BASIC' ? (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 text-xs">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span className="font-bold text-emerald-400">Basic Plan (Active)</span>
                {planStatus?.daysRemaining !== null && planStatus?.daysRemaining !== undefined && (
                  <span className="text-[10px] text-emerald-300 font-mono">({planStatus.daysRemaining}d left)</span>
                )}
              </div>
            ) : planStatus?.isLimitReached ? (
              <button
                onClick={() => openUpgradeModal('Free trial limit of 7 bills reached. Upgrade to Basic Plan (₹3,000/year) to continue.')}
                className="group flex items-center gap-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 px-3 py-1.5 text-xs text-rose-300 transition animate-pulse"
              >
                <AlertTriangle className="h-4 w-4 text-rose-400" />
                <span className="font-bold">7/7 Bills Used</span>
                <span className="flex items-center gap-1 rounded-lg bg-emerald-500 px-2 py-0.5 text-[10px] font-extrabold text-zinc-950 shadow">
                  <Zap className="h-3 w-3 fill-current" /> Upgrade ₹3,000/yr
                </span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400 font-medium">
                  <span>Free Trial:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                    {planStatus?.invoicesCount ?? 0}/{planStatus?.maxFreeInvoices ?? 7}
                  </span>
                  <span className="text-[11px] text-zinc-400">bills</span>
                </div>
                <button
                  onClick={() => openUpgradeModal()}
                  className="flex items-center gap-1 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm transition"
                >
                  <Sparkles className="h-3 w-3" /> Upgrade (₹3,000/yr)
                </button>
              </div>
            )}

            <ThemeToggle />
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
