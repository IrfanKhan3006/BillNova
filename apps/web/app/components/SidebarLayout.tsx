'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '../store/authStore';
import {
  LayoutDashboard,
  Receipt,
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
} from 'lucide-react';

export default function SidebarLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Create Invoice', href: '/billing', icon: Receipt },
    { name: 'Customers', href: '/customers', icon: Users },
    { name: 'Products & Inventory', href: '/products', icon: Package },
    { name: 'Payments', href: '/payments', icon: CreditCard },
    { name: 'Reports', href: '/reports', icon: BarChart3 },
    { name: 'Business Settings', href: '/business', icon: Settings },
  ];

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-zinc-800/80 bg-zinc-900/30 backdrop-blur-md sticky top-0 h-screen p-4 justify-between no-print">
        <div className="flex flex-col gap-8">
          {/* Logo / Title */}
          <div className="flex items-center gap-3 px-2 py-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-zinc-950 font-bold text-lg">
              B
            </div>
            <div>
              <h1 className="font-bold tracking-tight text-white">BillNova</h1>
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">ERP Platform</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/30 border border-transparent'
                  }`}
                >
                  <Icon className={`h-4.5 w-4.5 ${isActive ? 'text-emerald-400' : 'text-zinc-500'}`} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Card & Logout */}
        <div className="flex flex-col gap-4 border-t border-zinc-800/80 pt-4">
          <div className="flex items-center gap-3 px-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800 text-zinc-300">
              <UserIcon className="h-4 w-4" />
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium text-white truncate">{user?.name || 'User'}</p>
              <p className="text-[10px] text-zinc-500 font-semibold tracking-wider uppercase truncate">{user?.role || 'Staff'}</p>
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

      {/* Mobile Drawer Trigger & Navbar */}
      <div className="flex flex-col flex-1 min-w-0">
        <header className="flex md:hidden items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/30 backdrop-blur-md sticky top-0 z-40 no-print">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-zinc-950 font-bold text-md">
              B
            </div>
            <h1 className="font-bold tracking-tight text-white text-sm">BillNova</h1>
          </div>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-1 rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white"
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
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
                  {navItems.map((item) => {
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
        <header className="hidden md:flex items-center justify-between px-8 py-4 border-b border-zinc-805/50 bg-zinc-900/10 no-print">
          <div className="flex items-center gap-2">
            <Building className="h-5 w-5 text-emerald-500" />
            <h2 className="text-md font-semibold text-zinc-200">{user?.tenant?.name || 'Loading Business...'}</h2>
            {user?.tenant?.gstin && (
              <span className="ml-3 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400 uppercase border border-emerald-500/20">
                GST: {user.tenant.gstin}
              </span>
            )}
          </div>

          <div className="text-sm text-zinc-400 font-medium">
            Plan: <span className="text-emerald-400 font-semibold capitalize">{user?.tenant?.plan || 'Free'}</span>
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
