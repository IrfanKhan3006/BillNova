'use client';

import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';

export default function ThemeToggle() {
  const { user } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<'DARK' | 'LIGHT'>('DARK');

  const applyTheme = (t: 'DARK' | 'LIGHT') => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (t === 'LIGHT') {
      root.classList.remove('dark');
      root.classList.add('light');
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
    }
  };

  useEffect(() => {
    setMounted(true);
    const stored = typeof window !== 'undefined' ? localStorage.getItem('billnova_theme') : null;
    if (stored === 'LIGHT' || stored === 'DARK') {
      setTheme(stored);
      applyTheme(stored);
    } else if (user?.tenant?.theme === 'LIGHT' || user?.tenant?.theme === 'DARK') {
      setTheme(user.tenant.theme);
      applyTheme(user.tenant.theme);
    } else {
      const isDocLight = typeof document !== 'undefined' && document.documentElement.classList.contains('light');
      const detected = isDocLight ? 'LIGHT' : 'DARK';
      setTheme(detected);
    }
  }, [user?.tenant?.theme]);

  const toggleTheme = async () => {
    const nextTheme: 'DARK' | 'LIGHT' = theme === 'DARK' ? 'LIGHT' : 'DARK';
    setTheme(nextTheme);
    applyTheme(nextTheme);
    if (typeof window !== 'undefined') {
      localStorage.setItem('billnova_theme', nextTheme);
    }

    // If user is a tenant member, optionally persist theme to backend
    if (user?.tenantId) {
      try {
        await api.patch('/business', { theme: nextTheme });
        if (user.tenant) {
          const updatedUser = {
            ...user,
            tenant: { ...user.tenant, theme: nextTheme },
          };
          useAuthStore.setState({ user: updatedUser });
          if (typeof window !== 'undefined') {
            localStorage.setItem('user', JSON.stringify(updatedUser));
          }
        }
      } catch (err) {
        // Silently continue with local theme
        console.warn('Could not sync theme preference with backend:', err);
      }
    }
  };

  if (!mounted) {
    return (
      <div className="h-8 w-24 rounded-xl bg-zinc-200/60 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/50 animate-pulse" />
    );
  }

  const isDark = theme === 'DARK';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
      aria-label="Toggle theme"
      className="group relative flex items-center gap-2 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700/70 bg-white dark:bg-zinc-900/60 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-all duration-200 shadow-xs cursor-pointer select-none active:scale-95"
    >
      <div className="relative flex items-center justify-center h-4 w-4">
        {isDark ? (
          <Sun className="h-4 w-4 text-amber-500 dark:text-amber-400 transition-transform duration-300 group-hover:rotate-45" />
        ) : (
          <Moon className="h-4 w-4 text-indigo-500 dark:text-indigo-400 transition-transform duration-300 group-hover:-rotate-12" />
        )}
      </div>
      <span className="text-xs font-semibold tracking-wide">
        {isDark ? 'Light Mode' : 'Dark Mode'}
      </span>
    </button>
  );
}
