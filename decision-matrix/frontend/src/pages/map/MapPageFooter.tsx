import type { DrawMode } from '../../components/MapView';
import type { MapBulkProgressUpdate } from '../../lib/mapBulkProgress';
import {
  clampLineLodScaleThreshold,
  formatScaleDenominator,
  LINE_LOD_SCALE_MAX,
  LINE_LOD_SCALE_MIN,
  LINE_LOD_SCALE_STEP,
  lineLodForScale,
} from '../../lib/mapLineLod';

export type MapPageFooterProps = {
  mapScaleLabel: string;
  geometrySavePending: number;
  bulkProgress: MapBulkProgressUpdate | null;
  drawMode: DrawMode;
  mapIn3d: boolean;
  mapFooterHint: string | null;
  rulerPointsLength: number;
  autoroadNetworkPending: boolean;
  autoroadNetworkPickMode: 'click' | 'box';
  lineDraftLength: number;
  lineLodScaleThreshold: number;
  mapScaleDenominator: number;
  onLineLodChange: (threshold: number) => void;
};

export function MapPageFooter({
  mapScaleLabel,
  geometrySavePending,
  bulkProgress,
  drawMode,
  mapIn3d,
  mapFooterHint,
  rulerPointsLength,
  autoroadNetworkPending,
  autoroadNetworkPickMode,
  lineDraftLength,
  lineLodScaleThreshold,
  mapScaleDenominator,
  onLineLodChange,
}: MapPageFooterProps) {
  const bulkPercent =
    bulkProgress && bulkProgress.total > 0 && !bulkProgress.indeterminate
      ? Math.min(100, Math.round((bulkProgress.done / bulkProgress.total) * 100))
      : 0;

  return (
    <div className="map-footer">
      <span>
        Масштаб: <strong>{mapScaleLabel}</strong>
      </span>
      {bulkProgress && (
        <div className="map-paste-progress" role="status" aria-live="polite">
          <span className="map-paste-progress-label">
            {bulkProgress.label}: {bulkProgress.done} / {bulkProgress.total}
            {bulkProgress.chunkTotal > 1
              ? ` · часть ${Math.min(bulkProgress.chunkIndex, bulkProgress.chunkTotal)} / ${bulkProgress.chunkTotal}`
              : ''}
          </span>
          <div
            className="map-paste-progress-track"
            aria-hidden
            {...(!bulkProgress.indeterminate
              ? { 'aria-valuenow': bulkPercent, 'aria-valuemin': 0, 'aria-valuemax': 100 }
              : {})}
          >
            <div
              className={`map-paste-progress-bar${
                bulkProgress.indeterminate ? ' map-paste-progress-bar--indeterminate' : ''
              }`}
              style={bulkProgress.indeterminate ? undefined : { width: `${bulkPercent}%` }}
            />
          </div>
        </div>
      )}
      {!bulkProgress && geometrySavePending > 0 && <span>Сохранение геометрии…</span>}
      {!bulkProgress && geometrySavePending === 0 && drawMode === 'ruler' && (
        <span>
          {rulerPointsLength === 0
            ? 'Линейка: клик — вершина'
            : 'Двойной клик — завершить измерение'}
        </span>
      )}
      {!bulkProgress && geometrySavePending === 0 && drawMode === 'autoroad_network' && (
        <span>
          {autoroadNetworkPending
            ? 'Расчёт сети на сервере…'
            : autoroadNetworkPickMode === 'box'
              ? 'Сеть: рамка на карте или «Видимые» — добавить терминалы; нужно ≥2'
              : 'Сеть: клик по объекту — добавить/убрать; нужно ≥2 терминалов'}
        </span>
      )}
      {!bulkProgress && geometrySavePending === 0 && drawMode === 'line' && (
        <span>
          {lineDraftLength === 0
            ? 'Линия: первая точка — клик по точечному объекту на карте'
            : 'Промежуточные вершины — свободно; двойной ЛКМ/ПКМ или Enter — завершить (в пустом месте — узел)'}
        </span>
      )}
      {mapIn3d && (
        <span>ПКМ + перетаскивание — поворот камеры; колёсико — масштаб</span>
      )}
      {!mapIn3d && !bulkProgress && geometrySavePending === 0 && drawMode === 'select' && mapFooterHint && (
        <span>{mapFooterHint}</span>
      )}
      {!mapIn3d && (
        <div
          className="map-footer-lod"
          title="При масштабе карты 1:N не детальнее порога линия показывается только между концами (без промежуточных вершин)"
        >
          <span className="map-footer-lod-label">Упр. линий</span>
          <input
            type="range"
            className="map-footer-lod-slider"
            min={LINE_LOD_SCALE_MIN}
            max={LINE_LOD_SCALE_MAX}
            step={LINE_LOD_SCALE_STEP}
            value={lineLodScaleThreshold}
            onChange={(e) =>
              onLineLodChange(clampLineLodScaleThreshold(Number(e.target.value)))
            }
            aria-label="Порог масштаба упрощения линий"
          />
          <span className="map-footer-lod-value">
            от 1:{formatScaleDenominator(lineLodScaleThreshold)}
            {mapScaleDenominator > 0 &&
            lineLodForScale(mapScaleDenominator, lineLodScaleThreshold) === 'endpoints'
              ? ' · вкл.'
              : ''}
          </span>
        </div>
      )}
    </div>
  );
}
