import { Minus, Pencil, Ruler, X } from 'lucide-react';
import { Button } from 'antd';
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
      <Button
        size="small"
        className="map-tool-btn map-tool-btn--action"
        disabled={drawStepBackDisabled}
        onClick={onDrawStepBack}
        title="Удалить последнюю вершину"
        icon={<Minus size={14} className="shrink-0" aria-hidden />}
      >
        <span className="map-tool-label">Назад</span>
      </Button>
      <Button
        size="small"
        type="primary"
        className="map-tool-btn map-tool-btn--action"
        disabled={drawFinishDisabled}
        onClick={onDrawFinish}
        title={
          drawMode === 'line'
            ? 'Завершить линию (двойной ЛКМ/ПКМ; в пустом месте — узел)'
            : 'Завершить измерение (или двойной клик на карте)'
        }
        icon={
          drawMode === 'line' ? (
            <Pencil size={14} className="shrink-0" aria-hidden />
          ) : (
            <Ruler size={14} className="shrink-0" aria-hidden />
          )
        }
      >
        <span className="map-tool-label">Готово</span>
      </Button>
      <Button
        size="small"
        className="map-tool-btn map-tool-btn--action"
        disabled={drawResetDisabled}
        onClick={onDrawReset}
        title={drawMode === 'line' ? 'Сбросить линию' : 'Сбросить все измерения'}
        icon={<X size={14} className="shrink-0" aria-hidden />}
      >
        <span className="map-tool-label">Сброс</span>
      </Button>
    </div>
  );
}
