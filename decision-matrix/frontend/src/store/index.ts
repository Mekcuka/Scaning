import { create } from 'zustand';
import { api, clearStoredCsrf, type AuthUser } from '../lib/api';

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, username: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  login: async (email, password) => {
    const user = await api.login(email, password);
    set({ user, isLoading: false });
  },
  register: async (email, password, username) => {
    const user = await api.register(email, password, username);
    set({ user, isLoading: false });
  },
  logout: async () => {
    try {
      await api.logout();
    } catch {
      /* clear local state even if server unreachable */
    }
    clearStoredCsrf();
    set({ user: null });
  },
  fetchUser: async () => {
    try {
      const user = await api.me();
      set({ user });
    } catch {
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
  toggleTheme: () => {
    const next = get().theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', next);
    document.documentElement.classList.toggle('dark', next === 'dark');
    set({ theme: next });
  },
  setCurrentProjectId: (id) => {
    if (id) localStorage.setItem('currentProjectId', id);
    else localStorage.removeItem('currentProjectId');
    set({ currentProjectId: id });
  },
  bumpMapRefresh: () => set((s) => ({ mapRefreshNonce: s.mapRefreshNonce + 1 })),
}));
