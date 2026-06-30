import { ClipboardPaste, Copy, PenLine, Scissors, Trash2, Undo2 } from 'lucide-react';
import { Button } from 'antd';

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
      <Button
        size="small"
        type={mapEditEnabled ? 'primary' : 'default'}
        className={`map-tool-btn ${mapEditEnabled ? 'active' : ''}`}
        icon={<PenLine size={14} />}
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
      />
      <Button
        size="small"
        className="map-tool-btn"
        icon={<Undo2 size={14} />}
        title="Отменить последнее действие (Ctrl+Z)"
        aria-label="Отменить"
        disabled={!canEditMap || !canUndo}
        onClick={onUndo}
      />
      <Button
        size="small"
        className="map-tool-btn"
        icon={<Copy size={14} />}
        title="Копировать (Ctrl+C)"
        aria-label="Копировать"
        disabled={!canCopy}
        onClick={onCopy}
      />
      <Button
        size="small"
        className="map-tool-btn"
        icon={<ClipboardPaste size={14} />}
        title="Вставить (Ctrl+V)"
        aria-label="Вставить"
        disabled={!canPaste}
        onClick={onPaste}
      />
      <Button
        size="small"
        className="map-tool-btn"
        icon={<Scissors size={14} />}
        title="Вырезать (Ctrl+X)"
        aria-label="Вырезать"
        disabled={!canCut}
        onClick={onCut}
      />
      <Button
        size="small"
        className="map-tool-btn"
        icon={<Trash2 size={14} />}
        title={
          !canDelete
            ? selectedOnMapCount === 0
              ? 'Выберите объект на карте (клик или рамка)'
              : 'Недостаточно прав для удаления выбранных объектов'
            : `Удалить выбранные объекты (${selectedOnMapCount})`
        }
        disabled={!canDelete || selectedOnMapCount === 0 || deletePending}
        loading={deletePending}
        aria-label="Удалить выбранное"
        onClick={onDelete}
      />
    </div>
  );
}
