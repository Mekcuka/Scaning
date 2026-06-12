import { Download, Mountain } from 'lucide-react';

interface DemOverlayToolbarControlsProps {
  showDemOverlay: boolean;
  onShowDemOverlayChange: (value: boolean) => void;
  demAvailable: boolean;
  onFetchDem?: () => void;
  fetchDemPending?: boolean;
  readOnly?: boolean;
}

export function DemOverlayToolbarControls({
  showDemOverlay,
  onShowDemOverlayChange,
  demAvailable,
  onFetchDem,
  fetchDemPending = false,
  readOnly = false,
}: DemOverlayToolbarControlsProps) {
  return (
    <>
      <div className="pad-earthwork-sketch-toolbar__sep" aria-hidden />
      <div className="pad-earthwork-sketch-toolbar__group">
        <button
          type="button"
          className={`pad-earthwork-sketch-toolbar__btn${showDemOverlay ? ' pad-earthwork-sketch-toolbar__btn--active' : ''}`}
          title="Показать рельеф DEM и насыпь/выемку под контуром"
          aria-pressed={showDemOverlay}
          disabled={!demAvailable}
          onClick={() => onShowDemOverlayChange(!showDemOverlay)}
        >
          <Mountain size={16} aria-hidden />
          <span className="pad-earthwork-sketch-toolbar__label">Рельеф DEM</span>
        </button>
        {!demAvailable && onFetchDem && (
          <button
            type="button"
            className="pad-earthwork-sketch-toolbar__btn"
            title="Загрузить DEM с OpenTopography"
            disabled={readOnly || fetchDemPending}
            onClick={onFetchDem}
          >
            <Download size={16} aria-hidden />
            <span className="pad-earthwork-sketch-toolbar__label">
              {fetchDemPending ? 'DEM…' : 'Загрузить DEM'}
            </span>
          </button>
        )}
      </div>
    </>
  );
}
