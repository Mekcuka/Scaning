import { useEffect, useRef } from 'react';
import { App } from 'antd';
import { useAppStore } from '../store';

/** Bridges Zustand pushToast to Ant Design message API. */
export function ToastBridge() {
  const { message } = App.useApp();
  const toasts = useAppStore((s) => s.toasts);
  const dismissToast = useAppStore((s) => s.dismissToast);
  const seenRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    for (const toast of toasts) {
      if (seenRef.current.has(toast.id)) continue;
      seenRef.current.add(toast.id);
      const hide = () => dismissToast(toast.id);
      const opts = { content: toast.text, onClose: hide, duration: 4 };
      if (toast.tone === 'error') {
        message.error(opts);
      } else if (toast.tone === 'success') {
        message.success(opts);
      } else {
        message.info(opts);
      }
      dismissToast(toast.id);
    }
  }, [toasts, message, dismissToast]);

  return null;
}
