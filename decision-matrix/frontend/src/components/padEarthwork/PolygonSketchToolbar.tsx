import { Eraser, Maximize2, MousePointer2, PenLine, Plus, Ruler, ZoomIn, ZoomOut } from 'lucide-react';
import type { PolygonEditTool } from '../../lib/padEarthworkSketch';
import { DemOverlayToolbarControls } from './DemOverlayToolbarControls';

interface PolygonSketchToolbarProps {
  tool: PolygonEditTool;
  onToolChange: (tool: PolygonEditTool) => void;
  snapEnabled: boolean;
  onSnapChange: (value: boolean) => void;
  showEdgeLengths: boolean;
  onShowEdgeLengthsChange: (value: boolean) => void;
  vertexCount: number;
  closed: boolean;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  readOnly?: boolean;
  showDemOverlay?: boolean;
  onShowDemOverlayChange?: (value: boolean) => void;
  demAvailable?: boolean;
  onFetchDem?: () => void;
  fetchDemPending?: boolean;
}

const TOOLS: { id: PolygonEditTool; label: string; icon: typeof PenLine }[] = [
  { id: 'draw', label: 'Рисовать', icon: PenLine },
  { id: 'vertices', label: 'Вершины', icon: MousePointer2 },
  { id: 'insert', label: 'Вставить', icon: Plus },
  { id: 'erase', label: 'Удалить', icon: Eraser },
];

export function PolygonSketchToolbar({
  tool,
  onToolChange,
  snapEnabled,
  onSnapChange,
  showEdgeLengths,
  onShowEdgeLengthsChange,
  vertexCount,
  closed,
  zoom,
  onZoomIn,
  onZoomOut,
  onFitView,
  readOnly = false,
  showDemOverlay = false,
  onShowDemOverlayChange,
  demAvailable = false,
  onFetchDem,
  fetchDemPending = false,
}: PolygonSketchToolbarProps) {
  return (
    <div className="pad-earthwork-sketch-toolbar" role="toolbar" aria-label="Инструменты полигона">
      <div className="pad-earthwork-sketch-toolbar__group">
        {TOOLS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={`pad-earthwork-sketch-toolbar__btn${tool === id ? ' pad-earthwork-sketch-toolbar__btn--active' : ''}`}
            title={label}
            aria-pressed={tool === id}
            disabled={readOnly}
            onClick={() => onToolChange(id)}
          >
            <Icon size={16} aria-hidden />
            <span className="pad-earthwork-sketch-toolbar__label">{label}</span>
          </button>
        ))}
      </div>
      <div className="pad-earthwork-sketch-toolbar__sep" aria-hidden />
      <button
        type="button"
        className={`pad-earthwork-sketch-toolbar__btn${snapEnabled ? ' pad-earthwork-sketch-toolbar__btn--active' : ''}`}
        title="Привязка к сетке 1 м"
        aria-pressed={snapEnabled}
        disabled={readOnly}
        onClick={() => onSnapChange(!snapEnabled)}
      >
        <span className="pad-earthwork-sketch-toolbar__label">Сетка 1 м</span>
      </button>
      <button
        type="button"
        className={`pad-earthwork-sketch-toolbar__btn${showEdgeLengths ? ' pad-earthwork-sketch-toolbar__btn--active' : ''}`}
        title="Показывать длины сторон контура"
        aria-pressed={showEdgeLengths}
        onClick={() => onShowEdgeLengthsChange(!showEdgeLengths)}
      >
        <Ruler size={16} aria-hidden />
        <span className="pad-earthwork-sketch-toolbar__label">Длины</span>
      </button>
      <div className="pad-earthwork-sketch-toolbar__sep" aria-hidden />
      <div className="pad-earthwork-sketch-toolbar__group">
        <button
          type="button"
          className="pad-earthwork-sketch-toolbar__btn pad-earthwork-sketch-toolbar__btn--icon"
          title="Уменьшить"
          onClick={onZoomOut}
        >
          <ZoomOut size={16} aria-hidden />
        </button>
        <span className="pad-earthwork-sketch-toolbar__zoom">{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          className="pad-earthwork-sketch-toolbar__btn pad-earthwork-sketch-toolbar__btn--icon"
          title="Увеличить"
          onClick={onZoomIn}
        >
          <ZoomIn size={16} aria-hidden />
        </button>
        <button
          type="button"
          className="pad-earthwork-sketch-toolbar__btn pad-earthwork-sketch-toolbar__btn--icon"
          title="Вписать в экран"
          onClick={onFitView}
        >
          <Maximize2 size={16} aria-hidden />
        </button>
      </div>
      {onShowDemOverlayChange && (
        <DemOverlayToolbarControls
          showDemOverlay={showDemOverlay}
          onShowDemOverlayChange={onShowDemOverlayChange}
          demAvailable={demAvailable}
          onFetchDem={onFetchDem}
          fetchDemPending={fetchDemPending}
          readOnly={readOnly}
        />
      )}
      <span className="pad-earthwork-sketch-toolbar__meta">
        {vertexCount} верш.
        {!closed && ' · мин. 3 для расчёта'}
      </span>
    </div>
  );
}