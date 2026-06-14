import { RotateCcw, Shapes, Sparkles, Square } from 'lucide-react';
import {
  PAD_SIZE_PRESETS,
  rectangleToPolygon,
} from '../../lib/padEarthworkSketch';
import { clampPlanSketchZoom } from '../../lib/planSketchViewport';
import type { PadEarthworkSketchPlanTabProps } from './padEarthworkSketchPlanTabTypes';
import { PlanSketchToolbar } from './PlanSketchToolbar';
import { PlanViewToolbar } from './PlanViewToolbar';
import { PolygonSketchToolbar } from './PolygonSketchToolbar';

export type PadEarthworkSketchPlanToolbarProps = Pick<
  PadEarthworkSketchPlanTabProps,
  | 'showGenerator'
  | 'readOnly'
  | 'shapeMode'
  | 'handleShapeModeChange'
  | 'rectTool'
  | 'setRectTool'
  | 'polygonTool'
  | 'setPolygonTool'
  | 'snapEnabled'
  | 'setSnapEnabled'
  | 'lockAspect'
  | 'setLockAspect'
  | 'showEdgeLengths'
  | 'setShowEdgeLengths'
  | 'zoom'
  | 'setZoom'
  | 'handleFitView'
  | 'handleResetSketch'
  | 'handleClearPolygon'
  | 'demToolbarProps'
  | 'rectangleSketch'
  | 'polygonSketch'
  | 'polygonClosed'
  | 'wellsLocal'
  | 'updateSketch'
  | 'setShapeMode'
>;

export function PadEarthworkSketchPlanToolbar({
  showGenerator,
  readOnly,
  shapeMode,
  handleShapeModeChange,
  rectTool,
  setRectTool,
  polygonTool,
  setPolygonTool,
  snapEnabled,
  setSnapEnabled,
  lockAspect,
  setLockAspect,
  showEdgeLengths,
  setShowEdgeLengths,
  zoom,
  setZoom,
  handleFitView,
  handleResetSketch,
  handleClearPolygon,
  demToolbarProps,
  rectangleSketch,
  polygonSketch,
  polygonClosed,
  wellsLocal,
  updateSketch,
  setShapeMode,
}: PadEarthworkSketchPlanToolbarProps) {
  const applyRectanglePreset = (length_m: number, width_m: number) => {
    updateSketch({
      kind: 'plan_rectangle',
      length_m,
      width_m,
      rotation_deg: rectangleSketch.rotation_deg,
    });
  };

  const splitToPolygon = () => {
    setShapeMode('polygon');
    updateSketch(rectangleToPolygon(rectangleSketch));
    setPolygonTool('vertices');
  };

  return (
    <>
      <div className="pad-earthwork-sketch-modal__shape-toggle" role="group" aria-label="Тип контура">
        {showGenerator && (
          <button
            type="button"
            className={`pad-earthwork-sketch-modal__shape-btn${shapeMode === 'generator' ? ' pad-earthwork-sketch-modal__shape-btn--active' : ''}`}
            disabled={readOnly}
            onClick={() => handleShapeModeChange('generator')}
          >
            <Sparkles size={16} aria-hidden />
            Генератор
          </button>
        )}
        <button
          type="button"
          className={`pad-earthwork-sketch-modal__shape-btn${shapeMode === 'polygon' ? ' pad-earthwork-sketch-modal__shape-btn--active' : ''}`}
          disabled={readOnly}
          onClick={() => handleShapeModeChange('polygon')}
        >
          <Shapes size={16} aria-hidden />
          Произвольная
        </button>
        <button
          type="button"
          className={`pad-earthwork-sketch-modal__shape-btn${shapeMode === 'rectangle' ? ' pad-earthwork-sketch-modal__shape-btn--active' : ''}`}
          disabled={readOnly}
          onClick={() => handleShapeModeChange('rectangle')}
        >
          <Square size={16} aria-hidden />
          Прямоугольник
        </button>
      </div>

      {shapeMode === 'rectangle' ? (
        <PlanSketchToolbar
          tool={rectTool}
          onToolChange={setRectTool}
          snapEnabled={snapEnabled}
          onSnapChange={setSnapEnabled}
          lockAspect={lockAspect}
          onLockAspectChange={setLockAspect}
          showEdgeLengths={showEdgeLengths}
          onShowEdgeLengthsChange={setShowEdgeLengths}
          zoom={zoom}
          onZoomIn={() => setZoom((z) => clampPlanSketchZoom(z + 0.25))}
          onZoomOut={() => setZoom((z) => clampPlanSketchZoom(z - 0.25))}
          onFitView={handleFitView}
          readOnly={readOnly}
          {...demToolbarProps}
        />
      ) : shapeMode === 'polygon' ? (
        <PolygonSketchToolbar
          tool={polygonTool}
          onToolChange={setPolygonTool}
          snapEnabled={snapEnabled}
          onSnapChange={setSnapEnabled}
          showEdgeLengths={showEdgeLengths}
          onShowEdgeLengthsChange={setShowEdgeLengths}
          vertexCount={polygonSketch.vertices.length}
          closed={polygonClosed}
          zoom={zoom}
          onZoomIn={() => setZoom((z) => clampPlanSketchZoom(z + 0.25))}
          onZoomOut={() => setZoom((z) => clampPlanSketchZoom(z - 0.25))}
          onFitView={handleFitView}
          readOnly={readOnly}
          {...demToolbarProps}
        />
      ) : (
        <PlanViewToolbar
          snapEnabled={snapEnabled}
          onSnapChange={setSnapEnabled}
          showEdgeLengths={showEdgeLengths}
          onShowEdgeLengthsChange={setShowEdgeLengths}
          zoom={zoom}
          onZoomIn={() => setZoom((z) => clampPlanSketchZoom(z + 0.25))}
          onZoomOut={() => setZoom((z) => clampPlanSketchZoom(z - 0.25))}
          onFitView={handleFitView}
          meta={
            polygonClosed
              ? showGenerator
                ? `${polygonSketch.vertices.length} верш. · ${wellsLocal.length} скв.`
                : `${polygonSketch.vertices.length} верш.`
              : showGenerator
                ? 'Нажмите «Сгенерировать» для предпросмотра'
                : 'Добавьте вершины контура'
          }
          {...demToolbarProps}
        />
      )}

      {shapeMode === 'rectangle' && (
        <p className="object-detail-panel__hint text-xs pad-earthwork-sketch-modal__shape-hint">
          Углы меняют размер от центра. Для произвольной формы переключите «Произвольная» или
          нажмите «Разбить в полигон».
        </p>
      )}

      {shapeMode === 'rectangle' && (
        <div className="pad-earthwork-sketch-modal__presets">
          <span className="pad-earthwork-sketch-modal__presets-label">Типовые размеры:</span>
          {PAD_SIZE_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              className="pad-earthwork-sketch-modal__preset-chip"
              disabled={readOnly}
              onClick={() => applyRectanglePreset(p.length_m, p.width_m)}
            >
              {p.label} м
            </button>
          ))}
          {!readOnly && (
            <>
              <button
                type="button"
                className="pad-earthwork-sketch-modal__preset-chip"
                onClick={splitToPolygon}
              >
                Разбить в полигон
              </button>
              <button
                type="button"
                className="pad-earthwork-sketch-modal__preset-chip pad-earthwork-sketch-modal__preset-chip--ghost"
                title="Сбросить к 120×80 м"
                onClick={handleResetSketch}
              >
                <RotateCcw size={14} aria-hidden />
                Сброс
              </button>
            </>
          )}
        </div>
      )}

      {shapeMode === 'polygon' && !readOnly && (
        <div className="pad-earthwork-sketch-modal__presets">
          <span className="pad-earthwork-sketch-modal__presets-label">Контур:</span>
          <button
            type="button"
            className="pad-earthwork-sketch-modal__preset-chip"
            onClick={() => {
              updateSketch(rectangleToPolygon(rectangleSketch));
              setPolygonTool('vertices');
            }}
          >
            Из прямоугольника
          </button>
          <button
            type="button"
            className="pad-earthwork-sketch-modal__preset-chip pad-earthwork-sketch-modal__preset-chip--ghost"
            onClick={handleClearPolygon}
          >
            Очистить
          </button>
          <button
            type="button"
            className="pad-earthwork-sketch-modal__preset-chip pad-earthwork-sketch-modal__preset-chip--ghost"
            onClick={handleResetSketch}
          >
            <RotateCcw size={14} aria-hidden />
            Сброс
          </button>
        </div>
      )}
    </>
  );
}
