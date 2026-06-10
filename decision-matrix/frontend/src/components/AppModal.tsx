import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface AppModalProps {
  title?: string;
  titleId?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  closeOnBackdrop?: boolean;
  overlayClassName?: string;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function AppModal({
  title,
  titleId: titleIdProp,
  onClose,
  children,
  footer,
  size = 'md',
  closeOnBackdrop = true,
  overlayClassName,
}: AppModalProps) {
  const autoTitleId = useId();
  const titleId = titleIdProp ?? (title ? autoTitleId : undefined);
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
      if (e.key === 'Tab' && panelRef.current) {
        const nodes = panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE);
        if (nodes.length === 0) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    const body = panelRef.current?.querySelector('.app-modal-body');
    const focusTarget =
      body?.querySelector<HTMLElement>(FOCUSABLE) ??
      panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    focusTarget?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <div
      className={['app-modal-overlay', overlayClassName].filter(Boolean).join(' ')}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onMouseDown={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) onClose();
      }}
    >
      <div ref={panelRef} className={`app-modal-panel app-modal-panel--${size}`}>
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
