import { Copy, Scissors, X } from 'lucide-react';

interface ObjectDetailPanelHeaderProps {
  readOnly: boolean;
  displayName: string;
  setDisplayName: (value: string) => void;
  isDirty: boolean;
  isPoi: boolean;
  subtypeLabel: string;
  headerIcon: string;
  onCopy?: () => void;
  onCut?: () => void;
  onClose: () => void;
}

export function ObjectDetailPanelHeader({
  readOnly,
  displayName,
  setDisplayName,
  isDirty,
  isPoi,
  subtypeLabel,
  headerIcon,
  onCopy,
  onCut,
  onClose,
}: ObjectDetailPanelHeaderProps) {
  return (
    <header className="object-detail-panel__header">
      <div className="object-detail-panel__header-main">
        <img src={headerIcon} alt="" className="object-detail-panel__icon" draggable={false} />
        <div className="object-detail-panel__header-text min-w-0">
          <div className="object-detail-panel__title-row">
            {readOnly ? (
              <span className="object-detail-panel__title truncate" title={displayName}>
                {displayName}
              </span>
            ) : (
              <input
                type="text"
                className="object-detail-panel__title-input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                aria-label="Название объекта"
                title="Название объекта"
              />
            )}
            {isDirty && !readOnly && (
              <span className="object-detail-panel__dirty" title="Есть несохранённые изменения">
                ●
              </span>
            )}
          </div>
          <span className="object-detail-panel__badge">{isPoi ? 'Точка интереса' : subtypeLabel}</span>
        </div>
      </div>
      <div className="flex items-center gap-0.5 shrink-0">
        {onCopy && (
          <button
            type="button"
            className="btn btn-ghost btn-icon-touch"
            onClick={onCopy}
            title="Копировать (Ctrl+C)"
            aria-label="Копировать"
          >
            <Copy size={15} />
          </button>
        )}
        {onCut && (
          <button
            type="button"
            className="btn btn-ghost btn-icon-touch"
            onClick={onCut}
            title="Вырезать (Ctrl+X)"
            aria-label="Вырезать"
          >
            <Scissors size={15} />
          </button>
        )}
        <button
          type="button"
          className="btn btn-ghost btn-icon-touch object-detail-panel__close"
          onClick={onClose}
          title="Закрыть (Esc)"
          aria-label="Закрыть"
        >
          <X size={16} />
        </button>
      </div>
    </header>
  );
}
