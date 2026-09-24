import { create } from 'zustand';

export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  duration?: number;
}

export interface ConfirmState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  resolve?: (val: boolean) => void;
}

interface UIStore {
  toasts: ToastItem[];
  confirmState: ConfirmState;
  showToast: (message: string, type?: 'success' | 'error' | 'info', duration?: number) => void;
  removeToast: (id: string) => void;
  confirm: (options: {
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    danger?: boolean;
  }) => Promise<boolean>;
  closeConfirm: (result: boolean) => void;
}

export const useUIStore = create<UIStore>((set, get) => ({
  toasts: [],
  confirmState: {
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    danger: false,
  },
  showToast: (message, type = 'success', duration = 3500) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: ToastItem = { id, message, type, duration };
    set((state) => ({ toasts: [...state.toasts, newToast] }));

    if (duration > 0) {
      setTimeout(() => {
        get().removeToast(id);
      }, duration);
    }
  },
  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
  confirm: ({ title = 'Confirm Action', message, confirmText = 'Confirm', cancelText = 'Cancel', danger = false }) => {
    return new Promise<boolean>((resolve) => {
      set({
        confirmState: {
          isOpen: true,
          title,
          message,
          confirmText,
          cancelText,
          danger,
          resolve,
        },
      });
    });
  },
  closeConfirm: (result: boolean) => {
    const { resolve } = get().confirmState;
    if (resolve) resolve(result);
    set({
      confirmState: {
        isOpen: false,
        title: '',
        message: '',
        resolve: undefined,
      },
    });
  },
}));

// Direct helper functions callable anywhere (outside or inside React components)
export const toast = {
  success: (msg: string, duration?: number) => useUIStore.getState().showToast(msg, 'success', duration),
  error: (msg: string, duration?: number) => useUIStore.getState().showToast(msg, 'error', duration),
  info: (msg: string, duration?: number) => useUIStore.getState().showToast(msg, 'info', duration),
};

export const showConfirm = (options: {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}) => useUIStore.getState().confirm(options);
