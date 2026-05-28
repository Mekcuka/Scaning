import type { ToastItem } from '../hooks/useToasts';

type Props = {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
  /** Import-style top-right (default) or map-style bottom-right */
  position?: 'top' | 'bottom';
};

export function ToastStack({ toasts, onDismiss, position = 'top' }: Props) {
  if (toasts.length === 0) return null;

  return (
    <div
      className={`toast-stack${position === 'bottom' ? ' toast-stack-bottom' : ''}`}
      role="status"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.tone}`}>
          <span>{toast.text}</span>
          <button
            type="button"
            className="toast-close"
            onClick={() => onDismiss(toast.id)}
            aria-label="Закрыть уведомление"
            title="Закрыть"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
