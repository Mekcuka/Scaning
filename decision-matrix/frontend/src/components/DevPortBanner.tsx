import { useState } from 'react';
import { X } from 'lucide-react';

const DISMISS_KEY = 'dev-port-banner-dismiss';
const EXPECTED_PORT = '5173';

export function DevPortBanner() {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });

  if (!import.meta.env.DEV || dismissed) return null;

  const port = typeof window !== 'undefined' ? window.location.port : '';
  if (!port || port === EXPECTED_PORT) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      className="dev-port-banner"
      role="status"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.5rem 0.75rem',
        marginBottom: '0.5rem',
        borderRadius: '0.375rem',
        border: '1px solid var(--border)',
        background: 'color-mix(in srgb, var(--accent) 12%, var(--surface))',
        color: 'var(--text)',
        fontSize: '0.8125rem',
        lineHeight: 1.4,
      }}
    >
      <span style={{ flex: 1 }}>
        Frontend на порту <strong>{port}</strong>. Для стабильной работы используйте{' '}
        <a href={`http://localhost:${EXPECTED_PORT}/map`} style={{ textDecoration: 'underline' }}>
          http://localhost:{EXPECTED_PORT}
        </a>{' '}
        и остановите лишний dev-сервер.
      </span>
      <button
        type="button"
        className="btn btn-sm btn-secondary"
        onClick={dismiss}
        aria-label="Скрыть предупреждение"
        style={{ padding: '0.25rem 0.5rem' }}
      >
        <X size={14} />
      </button>
    </div>
  );
}
