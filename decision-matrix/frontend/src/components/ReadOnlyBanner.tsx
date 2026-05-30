import { Eye } from 'lucide-react';
import { usePermissions } from '../hooks/usePermissions';

export function ReadOnlyBanner() {
  const { isReadOnly } = usePermissions();

  if (!isReadOnly) return null;

  return (
    <div
      className="read-only-banner flex items-center gap-2 px-4 py-2 text-sm shrink-0"
      style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}
      role="status"
    >
      <Eye size={16} aria-hidden />
      <span>Режим просмотра — изменение данных недоступно</span>
    </div>
  );
}
