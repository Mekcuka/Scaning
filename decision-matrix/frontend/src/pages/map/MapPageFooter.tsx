import type { DrawMode } from '../../components/MapView';
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
  return (
    <div className="map-footer">
      <span>
        Масштаб: <strong>{mapScaleLabel}</strong>
      </span>
      {geometrySavePending > 0 && <span>Сохранение геометрии…</span>}
      {geometrySavePending === 0 && drawMode === 'ruler' && (
        <span>
          {rulerPointsLength === 0
            ? 'Линейка: клик — вершина'
            : 'Двойной клик или «Готово» — завершить'}
        </span>
      )}
      {geometrySavePending === 0 && drawMode === 'autoroad_network' && (
        <span>
          {autoroadNetworkPending
            ? 'Расчёт сети на сервере…'
            : autoroadNetworkPickMode === 'box'
              ? 'Сеть: рамка на карте или «Видимые» — добавить терминалы; нужно ≥2'
              : 'Сеть: клик по объекту — добавить/убрать; нужно ≥2 терминалов'}
        </span>
      )}
      {geometrySavePending === 0 && drawMode === 'line' && (
        <span>
          {lineDraftLength === 0
            ? 'Линия: первая точка — клик по точечному объекту на карте'
            : 'Промежуточные вершины — свободно; двойной ЛКМ/ПКМ, Enter или «Готово» — завершить (в пустом месте — узел)'}
        </span>
      )}
      {mapIn3d && (
        <span>ПКМ + перетаскивание — поворот камеры; колёсико — масштаб</span>
      )}
      {!mapIn3d && geometrySavePending === 0 && drawMode === 'select' && mapFooterHint && (
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
