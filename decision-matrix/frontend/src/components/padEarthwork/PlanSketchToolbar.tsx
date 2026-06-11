import {
  BoxSelect,
  Grid3x3,
  Link2,
  Maximize2,
  MoveHorizontal,
  RotateCw,
  Ruler,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { PlanEditTool } from '../../lib/padEarthworkSketch';

interface PlanSketchToolbarProps {
  tool: PlanEditTool;
  onToolChange: (tool: PlanEditTool) => void;
  snapEnabled: boolean;
  onSnapChange: (value: boolean) => void;
  lockAspect: boolean;
  onLockAspectChange: (value: boolean) => void;
  showEdgeLengths: boolean;
  onShowEdgeLengthsChange: (value: boolean) => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  readOnly?: boolean;
}

const TOOLS: { id: PlanEditTool; label: string; icon: typeof BoxSelect }[] = [
  { id: 'corners', label: 'Углы', icon: BoxSelect },
  { id: 'edges', label: 'Стороны', icon: MoveHorizontal },
  { id: 'rotate', label: 'Поворот', icon: RotateCw },
];

export function PlanSketchToolbar({
  tool,
  onToolChange,
  snapEnabled,
  onSnapChange,
  lockAspect,
  onLockAspectChange,
  showEdgeLengths,
  onShowEdgeLengthsChange,
  zoom,
  onZoomIn,
  onZoomOut,
  onFitView,
  readOnly = false,
}: PlanSketchToolbarProps) {
  return (
    <div className="pad-earthwork-sketch-toolbar" role="toolbar" aria-label="Инструменты схемы">
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
      <div className="pad-earthwork-sketch-toolbar__group">
        <button
          type="button"
          className={`pad-earthwork-sketch-toolbar__btn${snapEnabled ? ' pad-earthwork-sketch-toolbar__btn--active' : ''}`}
          title="Привязка к сетке 1 м"
          aria-pressed={snapEnabled}
          disabled={readOnly}
          onClick={() => onSnapChange(!snapEnabled)}
        >
          <Grid3x3 size={16} aria-hidden />
          <span className="pad-earthwork-sketch-toolbar__label">Сетка 1 м</span>
        </button>
        <button
          type="button"
          className={`pad-earthwork-sketch-toolbar__btn${lockAspect ? ' pad-earthwork-sketch-toolbar__btn--active' : ''}`}
          title="Сохранять пропорции при перетаскивании углов"
          aria-pressed={lockAspect}
          disabled={readOnly || tool !== 'corners'}
          onClick={() => onLockAspectChange(!lockAspect)}
        >
          <Link2 size={16} aria-hidden />
          <span className="pad-earthwork-sketch-toolbar__label">Пропорции</span>
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
      </div>
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
    </div>
  );
}
