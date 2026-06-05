import { Eye, Pencil } from 'lucide-react';

export function FlowSchematicMobileBanner({
  readOnly,
  isMobile,
  onEnableEdit,
  onDisableEdit,
}: {
  readOnly: boolean;
  isMobile: boolean;
  onEnableEdit: () => void;
  onDisableEdit: () => void;
}) {
  if (readOnly) {
    return (
      <div className="flow-mobile-view-banner">
        <Eye size={16} className="shrink-0 text-[var(--accent)]" aria-hidden />
        <span className="flex-1 min-w-0">
          Режим просмотра на телефоне. Для редактирования схемы используйте компьютер или включите
          редактирование.
        </span>
        <button type="button" className="btn btn-secondary btn-sm shrink-0" onClick={onEnableEdit}>
          <Pencil size={14} className="inline mr-1" />
          Редактировать
        </button>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="flow-mobile-view-banner">
        <Pencil size={16} className="shrink-0 text-[var(--primary)]" aria-hidden />
        <span className="flex-1 min-w-0">Режим редактирования на телефоне — упрощённая панель инструментов.</span>
        <button type="button" className="btn btn-ghost btn-sm shrink-0" onClick={onDisableEdit}>
          <Eye size={14} className="inline mr-1" />
          Только просмотр
        </button>
      </div>
    );
  }

  return null;
}
