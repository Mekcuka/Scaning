import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface AppModalProps {
  title?: string;
  titleId?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  closeOnBackdrop?: boolean;
}

export function AppModal({
  title,
  titleId,
  onClose,
  children,
  footer,
  size = 'md',
  closeOnBackdrop = true,
}: AppModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div
      className="app-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onMouseDown={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`app-modal-panel app-modal-panel--${size}`}>
        <div className="app-modal-header">
          {title ? (
            <h2 id={titleId} className="app-modal-title">
              {title}
            </h2>
          ) : (
            <span />
          )}
          <button
            type="button"
            className="app-modal-close btn btn-ghost"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <X size={20} />
          </button>
        </div>
        <div className="app-modal-body">{children}</div>
        {footer ? <div className="app-modal-footer">{footer}</div> : null}
      </div>
    </div>
  );
}
