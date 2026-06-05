import { ClipboardPaste, Copy, PenLine, Scissors, Trash2, Undo2 } from 'lucide-react';

export type MapPageToolbarEditGroupProps = {
  mapEditEnabled: boolean;
  onToggleMapEdit: () => void;
  canEditMap: boolean;
  mapIn3d: boolean;
  canUndo: boolean;
  onUndo: () => void;
  canCopy: boolean;
  onCopy: () => void;
  canPaste: boolean;
  onPaste: () => void;
  canCut: boolean;
  onCut: () => void;
  canDelete: boolean;
  selectedOnMapCount: number;
  deletePending: boolean;
  onDelete: () => void;
};

export function MapPageToolbarEditGroup({
  mapEditEnabled,
  onToggleMapEdit,
  canEditMap,
  mapIn3d,
  canUndo,
  onUndo,
  canCopy,
  onCopy,
  canPaste,
  onPaste,
  canCut,
  onCut,
  canDelete,
  selectedOnMapCount,
  deletePending,
  onDelete,
}: MapPageToolbarEditGroupProps) {
  return (
    <div className="map-tools-group map-tools-group--edit">
      <button
        type="button"
        className={`btn btn-sm map-tool-btn ${mapEditEnabled ? 'btn-primary active' : 'btn-secondary'}`}
        title={
          !canEditMap
            ? 'Редактирование недоступно в режиме просмотра'
            : mapEditEnabled
              ? 'Выключить редактирование на карте (E)'
              : 'Редактирование на карте: перемещение объектов, создание точек и линий (E)'
        }
        aria-label={
          mapEditEnabled ? 'Выключить редактирование на карте' : 'Включить редактирование на карте'
        }
        disabled={!canEditMap || mapIn3d}
        onClick={onToggleMapEdit}
      >
        <PenLine size={14} />
      </button>
      <button
        type="button"
        className="btn btn-sm map-tool-btn btn-secondary"
        title="Отменить последнее действие (Ctrl+Z)"
        aria-label="Отменить"
        disabled={!canEditMap || !canUndo}
        onClick={onUndo}
      >
        <Undo2 size={14} />
      </button>
      <button
        type="button"
        className="btn btn-sm map-tool-btn btn-secondary"
        title="Копировать (Ctrl+C)"
        aria-label="Копировать"
        disabled={!canCopy}
        onClick={onCopy}
      >
        <Copy size={14} />
      </button>
      <button
        type="button"
        className="btn btn-sm map-tool-btn btn-secondary"
        title="Вставить (Ctrl+V)"
        aria-label="Вставить"
        disabled={!canPaste}
        onClick={onPaste}
      >
        <ClipboardPaste size={14} />
      </button>
      <button
        type="button"
        className="btn btn-sm map-tool-btn btn-secondary"
        title="Вырезать (Ctrl+X)"
        aria-label="Вырезать"
        disabled={!canCut}
        onClick={onCut}
      >
        <Scissors size={14} />
      </button>
      <button
        type="button"
        className="btn btn-sm map-tool-btn btn-secondary"
        title={
          !canDelete
            ? selectedOnMapCount === 0
              ? 'Выберите объект на карте (клик или рамка)'
              : 'Недостаточно прав для удаления выбранных объектов'
            : `Удалить выбранные объекты (${selectedOnMapCount})`
        }
        disabled={!canDelete || selectedOnMapCount === 0 || deletePending}
        aria-label="Удалить выбранное"
        onClick={onDelete}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
