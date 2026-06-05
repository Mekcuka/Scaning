import { Minus, Pencil, Ruler, X } from 'lucide-react';
import type { DrawMode } from '../../../components/MapView';

export type MapPageToolbarDrawActionsProps = {
  drawMode: DrawMode;
  drawActionsVisible: boolean;
  drawStepBackDisabled: boolean;
  drawFinishDisabled: boolean;
  drawResetDisabled: boolean;
  onDrawStepBack: () => void;
  onDrawFinish: () => void;
  onDrawReset: () => void;
};

export function MapPageToolbarDrawActions({
  drawMode,
  drawActionsVisible,
  drawStepBackDisabled,
  drawFinishDisabled,
  drawResetDisabled,
  onDrawStepBack,
  onDrawFinish,
  onDrawReset,
}: MapPageToolbarDrawActionsProps) {
  return (
    <div
      className={`map-tools-draw-actions${drawActionsVisible ? ' map-tools-draw-actions--visible' : ''}`}
      aria-hidden={!drawActionsVisible}
    >
      <button
        type="button"
        className="btn btn-sm map-tool-btn map-tool-btn--action btn-secondary"
        disabled={drawStepBackDisabled}
        onClick={onDrawStepBack}
        title="Удалить последнюю вершину"
      >
        <Minus size={14} className="shrink-0" aria-hidden />
        <span className="map-tool-label">Назад</span>
      </button>
      <button
        type="button"
        className="btn btn-sm map-tool-btn map-tool-btn--action btn-primary"
        disabled={drawFinishDisabled}
        onClick={onDrawFinish}
        title={
          drawMode === 'line'
            ? 'Завершить линию (двойной ЛКМ/ПКМ; в пустом месте — узел)'
            : 'Завершить измерение (или двойной клик на карте)'
        }
      >
        {drawMode === 'line' ? (
          <Pencil size={14} className="shrink-0" aria-hidden />
        ) : (
          <Ruler size={14} className="shrink-0" aria-hidden />
        )}
        <span className="map-tool-label">Готово</span>
      </button>
      <button
        type="button"
        className="btn btn-sm map-tool-btn map-tool-btn--action btn-secondary"
        disabled={drawResetDisabled}
        onClick={onDrawReset}
        title={drawMode === 'line' ? 'Сбросить линию' : 'Сбросить все измерения'}
      >
        <X size={14} className="shrink-0" aria-hidden />
        <span className="map-tool-label">Сброс</span>
      </button>
    </div>
  );
}
