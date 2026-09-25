'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import {
  LayoutDashboard,
  Building2,
  LogOut,
  User as UserIcon,
  Menu,
  X,
  Shield,
  Zap,
} from 'lucide-react';
import ThemeToggle from './ThemeToggle';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [pendingRequestsCount, setPendingRequestsCount] = useState<number>(0);

  useEffect(() => {
    async function checkPending() {
      try {
        const data = await api.get('/admin/requests');
        if (Array.isArray(data)) {
          setPendingRequestsCount(data.length);
        }
      } catch {}
    }
    checkPending();
  }, [pathname]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const navItems = [
    { name: 'Platform Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Manage Businesses', href: '/admin/tenants', icon: Building2 },
    {
      name: 'Activation Requests',
      href: '/admin/requests',
      icon: Zap,
      badge: pendingRequestsCount,
    },
  ];

  return (
    <div className="flex min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-zinc-800/80 bg-zinc-900/30 backdrop-blur-md sticky top-0 h-screen p-4 justify-between no-print">
        <div className="flex flex-col gap-8">
          {/* Logo / Title */}
          <div className="flex items-center gap-3 px-2 py-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500 text-zinc-950 font-bold text-lg">
              A
            </div>
            <div>
              <h1 className="font-bold tracking-tight text-white flex items-center gap-1.5">
                BillNova <Shield className="h-3.5 w-3.5 text-purple-400" />
              </h1>
              <span className="text-[10px] uppercase tracking-wider text-purple-400 font-bold">Super Admin</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-1.5">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition duration-150 ${
                    isActive
                      ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20 font-bold'
                      : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`h-4.5 w-4.5 ${isActive ? 'text-purple-400' : 'text-zinc-500'}`} />
                    <span>{item.name}</span>
                  </div>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-black text-zinc-950 animate-pulse">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Card & Logout */}
        <div className="flex flex-col gap-4 border-t border-zinc-800/80 pt-4">
          <div className="flex items-center gap-3 px-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-500/10 text-purple-400">
              <UserIcon className="h-4 w-4" />
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium text-white truncate">{user?.name || 'Admin'}</p>
              <p className="text-[10px] text-purple-400 font-bold tracking-wider uppercase truncate">Platform Owner</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition duration-150"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Header & Content */}
      <div className="flex flex-col flex-1 min-w-0">
        <header className="flex md:hidden items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/30 backdrop-blur-md sticky top-0 z-40 no-print">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500 text-zinc-950 font-bold text-md">
              A
            </div>
            <h1 className="font-bold tracking-tight text-white text-sm">BillNova Admin</h1>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="text-zinc-400 hover:text-white transition"
            >
              {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </header>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-30 bg-zinc-950/95 backdrop-blur-lg pt-20 px-6 flex flex-col justify-between pb-8 no-print">
            <nav className="flex flex-col gap-2">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center justify-between px-4 py-3.5 rounded-xl text-md font-medium transition ${
                      isActive ? 'bg-purple-500/10 text-purple-400 font-bold' : 'text-zinc-400'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-5 w-5" />
                      <span>{item.name}</span>
                    </div>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-black text-zinc-950">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>

            <div className="flex flex-col gap-4 border-t border-zinc-800/80 pt-6">
              <div className="flex items-center gap-3 px-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-purple-400">
                  <UserIcon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{user?.name}</p>
                  <p className="text-[10px] text-purple-400 font-bold tracking-wider uppercase">Super Admin</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-md font-medium text-red-400 bg-red-500/5 hover:bg-red-500/10 transition"
              >
                <LogOut className="h-5 w-5" />
                Sign Out
              </button>
            </div>
          </div>
        )}

        {/* Desktop Header */}
        <header className="hidden md:flex items-center justify-between px-8 py-4 border-b border-zinc-800/80 bg-zinc-900/10 no-print">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-bold tracking-wider px-2.5 py-1 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20">
              Super Admin Console
            </span>
          </div>
          <ThemeToggle />
        </header>

        {/* Main Content Area */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
