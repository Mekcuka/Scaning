import { Maximize2, Ruler, ZoomIn, ZoomOut } from 'lucide-react';
import { DemOverlayToolbarControls } from './DemOverlayToolbarControls';

interface PlanViewToolbarProps {
  snapEnabled: boolean;
  onSnapChange: (value: boolean) => void;
  showEdgeLengths: boolean;
  onShowEdgeLengthsChange: (value: boolean) => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  meta?: string;
  showDemOverlay?: boolean;
  onShowDemOverlayChange?: (value: boolean) => void;
  demAvailable?: boolean;
  onFetchDem?: () => void;
  fetchDemPending?: boolean;
  readOnly?: boolean;
}

export function PlanViewToolbar({
  snapEnabled,
  onSnapChange,
  showEdgeLengths,
  onShowEdgeLengthsChange,
  zoom,
  onZoomIn,
  onZoomOut,
  onFitView,
  meta,
  showDemOverlay = false,
  onShowDemOverlayChange,
  demAvailable = false,
  onFetchDem,
  fetchDemPending = false,
  readOnly = false,
}: PlanViewToolbarProps) {
  return (
    <div className="pad-earthwork-sketch-toolbar" role="toolbar" aria-label="Просмотр плана">
      <button
        type="button"
        className={`pad-earthwork-sketch-toolbar__btn${snapEnabled ? ' pad-earthwork-sketch-toolbar__btn--active' : ''}`}
        title="Привязка к сетке 1 м"
        aria-pressed={snapEnabled}
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
      {meta && <span className="pad-earthwork-sketch-toolbar__meta">{meta}</span>}
    </div>
  );
}
