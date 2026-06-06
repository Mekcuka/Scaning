import { getPointResolution, transform } from 'ol/proj';
import { lineLodForScale } from '../../lib/mapLineLod';
import { MAP_BBOX_DEBOUNCE_MS } from '../../lib/mapBboxUtils';
import {
  saveMapViewState,
} from '../../lib/mapViewState';
import type { MapSetupContext } from './mapSetupContext';

export type ViewHandlersCleanup = {
  clearBboxTimer: () => void;
  disconnectResize: () => void;
};

export function setupViewHandlers(ctx: MapSetupContext): ViewHandlersCleanup {
  const { refs, interactions } = ctx;
  const { map } = interactions;
  const {
    containerRef,
    mapRef,
    lineLayerRef,
    mapZoomRef,
    lineLodRef,
    mapScaleDenominatorRef,
    lineLodScaleThresholdRef,
    syncInfraDataToLayersRef,
    onViewChangeRef,
    persistViewStateRef,
    onViewStateSnapshotRef,
    viewStateIdRef,
    viewStateScopeRef,
    projectIdRef,
    onBboxChangeRef,
    onFitViewRef,
  } = refs;

  const reportView = () => {
    const view = map.getView();
    const zoom = view.getZoom() ?? 0;
    const resolution = view.getResolution();
    const center = view.getCenter();
    let scaleLabel = '—';
    let scaleDenominator = 1;
    if (resolution != null && center) {
      const res = getPointResolution('EPSG:3857', resolution, center);
      scaleDenominator = Math.max(1, Math.round(res * 39.37 * 72));
      scaleLabel = `1:${scaleDenominator.toLocaleString('ru-RU')}`;
    }
    mapZoomRef.current = zoom;
    mapScaleDenominatorRef.current = scaleDenominator;
    const lineLod = lineLodForScale(scaleDenominator, lineLodScaleThresholdRef.current);
    if (lineLodRef.current !== lineLod) {
      lineLodRef.current = lineLod;
      syncInfraDataToLayersRef.current?.();
      lineLayerRef.current?.changed();
    }
    onViewChangeRef.current?.({ zoom, scaleLabel, scaleDenominator });
  };

  const persistView = () => {
    if (!persistViewStateRef.current) return;
    const vid = viewStateIdRef.current;
    if (!vid) return;
    const view = map.getView();
    const center = view.getCenter();
    const zoom = view.getZoom();
    if (!center || zoom == null) return;
    const [centerLon, centerLat] = transform(center, 'EPSG:3857', 'EPSG:4326');
    const snap = { centerLon, centerLat, zoom };
    onViewStateSnapshotRef.current?.(snap);
    saveMapViewState(vid, projectIdRef.current ?? null, snap, viewStateScopeRef.current);
  };

  let bboxTimer: ReturnType<typeof setTimeout> | undefined;
  const emitBbox = () => {
    if (!onBboxChangeRef.current) return;
    const size = map.getSize();
    if (!size || size[0] === 0 || size[1] === 0) return;
    const extent = map.getView().calculateExtent(size);
    const [minX, minY, maxX, maxY] = extent;
    const [minLon, minLat] = transform([minX, minY], 'EPSG:3857', 'EPSG:4326');
    const [maxLon, maxLat] = transform([maxX, maxY], 'EPSG:3857', 'EPSG:4326');
    const round = (n: number) => Math.round(n * 1e6) / 1e6;
    onBboxChangeRef.current(
      `${round(minLon)},${round(minLat)},${round(maxLon)},${round(maxLat)}`,
    );
  };

  map.on('moveend', () => {
    reportView();
    persistView();
    if (!onBboxChangeRef.current) return;
    clearTimeout(bboxTimer);
    bboxTimer = setTimeout(emitBbox, MAP_BBOX_DEBOUNCE_MS);
  });
  reportView();
  emitBbox();

  const preserveViewOnResize = () => {
    const view = map.getView();
    const center = view.getCenter();
    const resolution = view.getResolution();
    map.updateSize();
    if (center && resolution != null) {
      view.setCenter(center);
      view.setResolution(resolution);
    }
  };

  const resizeObserver =
    typeof ResizeObserver !== 'undefined' && containerRef.current
      ? new ResizeObserver(() => preserveViewOnResize())
      : null;
  if (resizeObserver && containerRef.current) {
    resizeObserver.observe(containerRef.current);
  }

  mapRef.current = map;
  if (import.meta.env.VITE_E2E_MAP_HOOK === 'true') {
    (window as Window & { __dmOlMap?: typeof map }).__dmOlMap = map;
  }

  const zoomEl = containerRef.current!.querySelector('.ol-zoom');
  if (zoomEl && !zoomEl.querySelector('.ol-fit-view')) {
    const fitBtn = document.createElement('button');
    fitBtn.type = 'button';
    fitBtn.className = 'ol-fit-view';
    fitBtn.title = 'Показать все объекты';
    fitBtn.setAttribute('aria-label', 'Показать все объекты');
    fitBtn.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="12" r="3"/></svg>';
    fitBtn.addEventListener('click', (e) => {
      e.preventDefault();
      onFitViewRef.current?.();
    });
    zoomEl.appendChild(fitBtn);
  }

  return {
    clearBboxTimer: () => clearTimeout(bboxTimer),
    disconnectResize: () => resizeObserver?.disconnect(),
  };
}
