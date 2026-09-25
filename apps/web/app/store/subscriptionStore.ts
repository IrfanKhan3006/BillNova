import { create } from 'zustand';
import { api } from '../lib/api';

export interface PlanStatus {
  tenantId?: string;
  tenantName?: string;
  plan: 'FREE' | 'BASIC' | 'STARTER' | 'PRO' | 'ENTERPRISE';
  subscriptionStatus: 'TRIAL' | 'ACTIVE' | 'EXPIRED' | 'SUSPENDED';
  invoicesCount: number;
  maxFreeInvoices: number;
  invoicesRemaining: number;
  isLimitReached: boolean;
  isExpired: boolean;
  planExpiresAt: string | null;
  daysRemaining: number | null;
  planPrice: number;
  subscriptionPeriod: string;
  upgradeRequested: boolean;
  upgradeRequestedAt?: string | null;
}

interface SubscriptionStoreState {
  planStatus: PlanStatus | null;
  loading: boolean;
  isUpgradeModalOpen: boolean;
  modalMessage: string;

  // Actions
  openUpgradeModal: (message?: string) => void;
  closeUpgradeModal: () => void;
  fetchPlanStatus: () => Promise<PlanStatus | null>;
  requestUpgrade: (note?: string) => Promise<any>;
  setPlanStatus: (status: Partial<PlanStatus>) => void;
}

export const useSubscriptionStore = create<SubscriptionStoreState>((set, get) => ({
  planStatus: null,
  loading: false,
  isUpgradeModalOpen: false,
  modalMessage: '',

  openUpgradeModal: (message = '') => {
    set({
      isUpgradeModalOpen: true,
      modalMessage: message,
    });
  },

  closeUpgradeModal: () => {
    set({ isUpgradeModalOpen: false, modalMessage: '' });
  },

  setPlanStatus: (status) => {
    set((state) => ({
      planStatus: state.planStatus ? { ...state.planStatus, ...status } : (status as PlanStatus),
    }));
  },

  fetchPlanStatus: async () => {
    try {
      set({ loading: true });
      const data = await api.get('/business/plan');
      if (data) {
        set({ planStatus: data });
        return data;
      }
      return null;
    } catch {
      return null;
    } finally {
      set({ loading: false });
    }
  },

  requestUpgrade: async (note = '') => {
    const res = await api.post('/business/request-upgrade', { note });
    if (res && res.success) {
      set((state) => ({
        planStatus: state.planStatus
          ? { ...state.planStatus, upgradeRequested: true }
          : null,
      }));
    }
    return res;
  },
}));
