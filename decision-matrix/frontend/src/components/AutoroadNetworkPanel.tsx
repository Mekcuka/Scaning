import { Route, Trash2, X } from 'lucide-react';
import type { MapGroupSelectionItem } from './MapGroupSelectionPanel';

type Props = {
  items: MapGroupSelectionItem[];
  onClear: () => void;
  onPreview: () => void;
  canPreview: boolean;
  pending?: boolean;
};

export function AutoroadNetworkPanel({
  items,
  onClear,
  onPreview,
  canPreview,
  pending = false,
}: Props) {
  return (
    <div
      className="absolute top-3 right-3 z-20 w-[min(320px,calc(100%-1.5rem))] rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-lg"
      role="region"
      aria-label="Построение сети автодорог"
    >
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Route size={16} className="shrink-0 text-[var(--primary)]" aria-hidden />
          <span>Сеть автодорог</span>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm p-1"
          title="Очистить выбор"
          aria-label="Очистить"
          onClick={onClear}
        >
          <X size={14} />
        </button>
      </div>
      <p className="px-3 py-2 text-xs text-[var(--muted)]">
        Клик по точечному объекту на карте — добавить или убрать. Узлы (Узел / метанол / ЛЭП) не
        выбираются.
      </p>
      <ul className="max-h-40 overflow-y-auto px-2 pb-2 text-sm">
        {items.length === 0 ? (
          <li className="px-1 py-1 text-[var(--muted)]">Нет выбранных объектов</li>
        ) : (
          items.map((item) => (
            <li key={item.id} className="truncate px-1 py-0.5" title={item.name}>
              {item.name}
            </li>
          ))
        )}
      </ul>
      <div className="flex flex-wrap gap-2 border-t border-[var(--border)] px-3 py-2">
        <button
          type="button"
          className="btn btn-primary btn-sm flex-1"
          disabled={!canPreview || pending}
          onClick={onPreview}
        >
          {pending ? 'Расчёт…' : 'Предпросмотр и применить'}
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={items.length === 0 || pending}
          title="Очистить список"
          onClick={onClear}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
