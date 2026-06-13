import { Clock, Crosshair, Layers, Loader2, Mountain, Route } from 'lucide-react';

type Props = {
  kbM: number;
  wellsCount: number;
  bottomholesCount: number;
  designedCount: number;
  demAvailable: boolean;
  demLoading: boolean;
  computedAt: string | null;
};

export function PadClusteringViewerStats({
  kbM,
  wellsCount,
  bottomholesCount,
  designedCount,
  demAvailable,
  demLoading,
  computedAt,
}: Props) {
  const computedLabel =
    computedAt &&
    (() => {
      const d = new Date(computedAt);
      return Number.isNaN(d.getTime()) ? null : d.toLocaleString('ru-RU');
    })();

  return (
    <div className="pad-clustering-viewer-stats" role="status">
      <div className="pad-clustering-stat-chip">
        <Mountain size={14} aria-hidden className="pad-clustering-stat-chip__icon" />
        <span className="pad-clustering-stat-chip__label">KB</span>
        <strong>{kbM.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} м</strong>
      </div>
      <div className="pad-clustering-stat-chip">
        <Layers size={14} aria-hidden className="pad-clustering-stat-chip__icon" />
        <span className="pad-clustering-stat-chip__label">Устья</span>
        <strong>{wellsCount}</strong>
      </div>
      <div className="pad-clustering-stat-chip">
        <Crosshair size={14} aria-hidden className="pad-clustering-stat-chip__icon" />
        <span className="pad-clustering-stat-chip__label">Забои</span>
        <strong>{bottomholesCount}</strong>
      </div>
      <div
        className={`pad-clustering-stat-chip${designedCount > 0 ? ' pad-clustering-stat-chip--ok' : ''}`}
      >
        <Route size={14} aria-hidden className="pad-clustering-stat-chip__icon" />
        <span className="pad-clustering-stat-chip__label">Траектории</span>
        <strong>{designedCount}</strong>
      </div>
      <div
        className={`pad-clustering-stat-chip${demAvailable ? ' pad-clustering-stat-chip--ok' : ''}`}
      >
        <span className="pad-clustering-stat-chip__label">DEM</span>
        {demLoading ? (
          <span className="pad-clustering-stat-chip__inline">
            <Loader2 size={13} className="pad-clustering-spin" aria-hidden />
            …
          </span>
        ) : (
          <strong>{demAvailable ? 'есть' : 'нет'}</strong>
        )}
      </div>
      {computedLabel && (
        <div className="pad-clustering-stat-chip pad-clustering-stat-chip--meta">
          <Clock size={13} aria-hidden className="pad-clustering-stat-chip__icon" />
          <span className="pad-clustering-stat-chip__label">Расчёт</span>
          <strong className="pad-clustering-stat-chip__time">{computedLabel}</strong>
        </div>
      )}
    </div>
  );
}
