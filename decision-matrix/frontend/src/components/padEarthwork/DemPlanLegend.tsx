import { formatElevationM, elevationGradientCss, type PadDemPreview } from '../../lib/padEarthworkDemPreview';

interface DemPlanLegendProps {
  preview: PadDemPreview;
}

export function DemPlanLegend({ preview }: DemPlanLegendProps) {
  return (
    <div className="pad-earthwork-sketch-editor__dem-legend">
      <div className="pad-earthwork-sketch-editor__dem-gradient-bar" aria-hidden>
        <div
          className="pad-earthwork-sketch-editor__dem-gradient-fill"
          style={{ background: elevationGradientCss() }}
        />
      </div>
      <div className="pad-earthwork-sketch-editor__dem-gradient-labels text-xs">
        <span>{formatElevationM(preview.elev_min)}</span>
        <span>{formatElevationM(preview.elev_max)}</span>
      </div>
      <p className="object-detail-panel__hint text-xs">
        Верх площадки: {formatElevationM(preview.design_elevation_m)}
      </p>
      <div className="pad-earthwork-sketch-editor__dem-legend-swatches">
        <span className="pad-earthwork-sketch-editor__dem-swatch pad-earthwork-sketch-editor__dem-swatch--cut">
          Выемка (рельеф выше опорной)
        </span>
      </div>
    </div>
  );
}
