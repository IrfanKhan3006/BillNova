import { create } from 'zustand';

interface User {
  id: string;
  tenantId: string | null;
  name: string;
  email: string;
  role: string;
  tenant?: {
    id: string;
    name: string;
    slug: string;
    gstin?: string;
    plan: string;
    logoUrl?: string;
    address?: string;
    phone?: string;
    invoiceTemplate?: string;
    billingEnabled?: boolean;
    productsEnabled?: boolean;
    paymentsEnabled?: boolean;
    reportsEnabled?: boolean;
  } | null;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  updateUserTenant: (tenantData: Partial<User['tenant']>) => void;
  logout: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: true,

  setAuth: (user, accessToken, refreshToken) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(user));
    set({ user, accessToken, isAuthenticated: true, isLoading: false });
  },

  updateUserTenant: (tenantData) => {
    set((state) => {
      if (!state.user) return state;
      const updatedUser = {
        ...state.user,
        tenant: {
          ...state.user.tenant,
          ...tenantData,
        } as any,
      };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      return { user: updatedUser };
    });
  },

  logout: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    set({ user: null, accessToken: null, isAuthenticated: false, isLoading: false });
  },

  hydrate: () => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('accessToken');
    const userStr = localStorage.getItem('user');
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        set({ user, accessToken: token, isAuthenticated: true, isLoading: false });
      } catch {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        set({ user: null, accessToken: null, isAuthenticated: false, isLoading: false });
      }
    } else {
      set({ isLoading: false });
    }
  },
}));
