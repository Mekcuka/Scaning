import { useAppStore, type ToastItem, type ToastTone } from '../store';

export type { ToastItem, ToastTone };

/** Глобальные toast (рендер в AppLayout, позиция внизу справа). */
export function useToasts() {
  const toasts = useAppStore((s) => s.toasts);
  const pushToast = useAppStore((s) => s.pushToast);
  const dismissToast = useAppStore((s) => s.dismissToast);
  return { toasts, pushToast, dismissToast };
}
