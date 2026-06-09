import { create } from 'zustand';
import { hasStoredAuthTokens } from '../lib/authSession';
import { api, clearServerSession, isCrossOriginApi, syncClientAuthSession, type AuthUser } from '../lib/api';

/** Ignore stale fetchUser() after login/register/logout. */
let authEpoch = 0;

function bumpAuthEpoch(): number {
  authEpoch += 1;
  return authEpoch;
}

async function confirmSession(epoch: number): Promise<AuthUser> {
  const me = await api.me();
  if (epoch !== authEpoch) {
    throw new Error('Сессия прервана');
  }
  return me;
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, username: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchUser: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  login: async (email, password) => {
    const epoch = bumpAuthEpoch();
    await clearServerSession();
    const user = await api.login(email, password);
    if (epoch !== authEpoch) return;
    try {
      const me = await confirmSession(epoch);
      set({ user: me, isLoading: false });
    } catch {
      set({ user, isLoading: false });
    }
  },
  register: async (email, password, username) => {
    const epoch = bumpAuthEpoch();
    const user = await api.register(email, password, username);
    if (epoch !== authEpoch) return;
    try {
      const me = await confirmSession(epoch);
      set({ user: me, isLoading: false });
    } catch {
      set({ user, isLoading: false });
    }
  },
  logout: async () => {
    bumpAuthEpoch();
    await clearServerSession();
    set({ user: null, isLoading: false });
  },
  fetchUser: async () => {
    const epoch = authEpoch;
    try {
      if (isCrossOriginApi() && !hasStoredAuthTokens()) {
        if (epoch !== authEpoch) return;
        set({ user: null });
        return;
      }
      const user = await api.me();
      if (epoch !== authEpoch) return;
      if (user) {
        await syncClientAuthSession();
      }
      if (epoch !== authEpoch) return;
      set({ user });
    } catch {
      if (epoch !== authEpoch) return;
      set({ user: null });
    } finally {
      if (epoch === authEpoch) {
        set({ isLoading: false });
      }
    }
  },
  refreshUser: async () => {
    const epoch = authEpoch;
    try {
      const user = await api.me();
      if (epoch !== authEpoch) return;
      set({ user });
    } catch {
      if (epoch !== authEpoch) return;
      set({ user: null });
    }
  },
}));

export function onAuthSessionLost(): void {
  bumpAuthEpoch();
  useAuthStore.setState({ user: null, isLoading: false });
}

export type ToastTone = 'info' | 'success' | 'error';

export type ToastItem = {
  id: number;
  tone: ToastTone;
  text: string;
};

const TOAST_DISMISS_MS = 5000;

export type AssistantUiContext = {
  selectedPoiId: string | null;
  selectedPoiName: string | null;
};

interface AppState {
  theme: 'light' | 'dark';
  currentProjectId: string | null;
  /** Incremented after import / bulk map data changes — MapPage resets bbox filter. */
  mapRefreshNonce: number;
  assistantUiContext: AssistantUiContext;
  toasts: ToastItem[];
  toggleTheme: () => void;
  setCurrentProjectId: (id: string | null) => void;
  setAssistantUiContext: (patch: Partial<AssistantUiContext>) => void;
  bumpMapRefresh: () => void;
  pushToast: (tone: ToastTone, text: string) => void;
  dismissToast: (id: number) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  theme: (localStorage.getItem('theme') as 'light' | 'dark') || 'light',
  currentProjectId: localStorage.getItem('currentProjectId'),
  mapRefreshNonce: 0,
  assistantUiContext: { selectedPoiId: null, selectedPoiName: null },
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
  setAssistantUiContext: (patch) =>
    set((s) => ({
      assistantUiContext: { ...s.assistantUiContext, ...patch },
    })),
  bumpMapRefresh: () => set((s) => ({ mapRefreshNonce: s.mapRefreshNonce + 1 })),
}));
