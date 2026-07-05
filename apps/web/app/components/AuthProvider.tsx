'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { hydrate, isAuthenticated, isLoading } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (isAuthenticated) {
      api.get('/auth/me')
        .then((res) => {
          // Update zustand state and localStorage to capture live feature gates
          useAuthStore.setState({ user: res });
          localStorage.setItem('user', JSON.stringify(res));
        })
        .catch((err) => {
          console.error('Failed to sync live session settings:', err);
        });
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isLoading) return;

    const isPublicPath = pathname === '/login' || pathname === '/register';
    const isLandingPage = pathname === '/';
    const isAdminPath = pathname.startsWith('/admin');

    if (isAuthenticated) {
      const user = useAuthStore.getState().user;
      if (user?.role === 'SUPER_ADMIN') {
        if (isPublicPath || !isAdminPath) {
          router.push('/admin/dashboard');
        }
      } else {
        if (isAdminPath) {
          router.push('/dashboard');
        } else if (isPublicPath) {
          router.push('/dashboard');
        }
      }
    } else if (!isPublicPath && !isLandingPage) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, pathname, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-950 text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-t-emerald-500 border-zinc-800" />
          <h2 className="text-lg font-semibold tracking-wider text-zinc-400">Loading BillNova...</h2>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
