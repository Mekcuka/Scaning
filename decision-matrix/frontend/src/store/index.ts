import { create } from 'zustand';
import { api } from '../lib/api';

interface AuthState {
  user: { id: string; email: string; username: string; role: string } | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  fetchUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  login: async (email, password) => {
    const tokens = await api.login(email, password);
    localStorage.setItem('access_token', tokens.access_token);
    localStorage.setItem('refresh_token', tokens.refresh_token);
    const user = await api.me();
    set({ user, isLoading: false });
  },
  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    set({ user: null });
  },
  fetchUser: async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      set({ isLoading: false, user: null });
      return;
    }
    try {
      const user = await api.me();
      set({ user });
    } catch {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      set({ user: null });
    } finally {
      set({ isLoading: false });
    }
  },
}));

export type ToastTone = 'info' | 'success' | 'error';

export type ToastItem = {
  id: number;
  tone: ToastTone;
  text: string;
};

const TOAST_DISMISS_MS = 5000;

interface AppState {
  theme: 'light' | 'dark';
  currentProjectId: string | null;
  /** Incremented after import / bulk map data changes — MapPage resets bbox filter. */
  mapRefreshNonce: number;
  toasts: ToastItem[];
  toggleTheme: () => void;
  setCurrentProjectId: (id: string | null) => void;
  bumpMapRefresh: () => void;
  pushToast: (tone: ToastTone, text: string) => void;
  dismissToast: (id: number) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  theme: (localStorage.getItem('theme') as 'light' | 'dark') || 'light',
  currentProjectId: localStorage.getItem('currentProjectId'),
  mapRefreshNonce: 0,
  toasts: [],
  pushToast: (tone, text) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    set((s) => ({ toasts: [...s.toasts, { id, tone, text }] }));
    window.setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, TOAST_DISMISS_MS);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  bumpMapRefresh: () => set((s) => ({ mapRefreshNonce: s.mapRefreshNonce + 1 })),
  toggleTheme: () => {
    const next = get().theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', next);
    document.documentElement.setAttribute('data-theme', next);
    set({ theme: next });
  },
  setCurrentProjectId: (id) => {
    if (id) localStorage.setItem('currentProjectId', id);
    else localStorage.removeItem('currentProjectId');
    set({ currentProjectId: id });
  },
}));
