import { transform } from 'ol/proj';
import {
  resolveHoverFeatureIdAtCoordinate,
  resolveInfraPointAtCoordinate,
} from '../../lib/mapHitTest';
import { createPointerFrameScheduler, pointerCoordsChanged } from '../../lib/mapPointerThrottle';
import { findSelectableLayerFeature } from './featureSelection';
import type { MapDrawHandlers } from './mapDrawHandlers';
import type { MapSetupContext } from './mapSetupContext';

export type PointerHandlersCleanup = {
  cancelPointer: () => void;
  removeViewportListeners: () => void;
};

export function setupPointerHandlers(
  ctx: MapSetupContext,
  helpers: {
    refreshDraggedFeatureVisual: () => void;
    applyLinkedLineDrag: () => void;
    onLineContextMenu: MapDrawHandlers['onLineContextMenu'];
    onLinePointerDown: MapDrawHandlers['onLinePointerDown'];
  },
): PointerHandlersCleanup {
  const { refs, interactions } = ctx;
  const { map } = interactions;
  const {
    containerRef,
    pointSourceRef,
    lineSourceRef,
    placementPreviewSourceRef,
    hoveredIdRef,
    drawModeRef,
    editModeRef,
    selectModeRef,
    lastPointerLonLatRef,
    onPointerMoveRef,
    onPointerLeaveRef,
  } = refs;
  const { refreshDraggedFeatureVisual, applyLinkedLineDrag, onLineContextMenu, onLinePointerDown } =
    helpers;

  const refreshHover = (hit: string | null) => {
    const prev = hoveredIdRef.current;
    if (hit === prev) return;
    const pointSource = pointSourceRef.current;
    const lineSource = lineSourceRef.current;
    if (prev) {
      const f = findSelectableLayerFeature(pointSource, lineSource, prev);
      if (f) f.changed();
    }
    hoveredIdRef.current = hit;
    if (hit) {
      const f = findSelectableLayerFeature(pointSource, lineSource, hit);
      if (f) f.changed();
    }
    if (containerRef.current) {
      const mode = drawModeRef.current;
      const inSelect = mode === 'select';
      const editing = editModeRef.current;
      containerRef.current.style.cursor = hit
        ? 'pointer'
        : mode === 'ruler' || mode === 'point' || mode === 'poi'
          ? 'crosshair'
          : !editing
            ? 'default'
            : inSelect
              ? selectModeRef.current === 'box'
                ? 'crosshair'
                : 'default'
              : 'crosshair';
    }
  };

  let pendingPointer: { coordinate: number[]; lon: number; lat: number } | null = null;
  const pointerScheduler = createPointerFrameScheduler(() => {
    const p = pendingPointer;
    if (!p) return;
    const pointSource = pointSourceRef.current;
    const lineSource = lineSourceRef.current;
    const overPoint = resolveInfraPointAtCoordinate(map, pointSource, p.coordinate, 20);
    if (pointerCoordsChanged(lastPointerLonLatRef.current, p.lon, p.lat)) {
      lastPointerLonLatRef.current = { lon: p.lon, lat: p.lat };
      onPointerMoveRef.current?.(
        p.lon,
        p.lat,
        overPoint ? { lon: overPoint.lon, lat: overPoint.lat } : undefined,
      );
    }
    const hit = resolveHoverFeatureIdAtCoordinate(
      map,
      pointSource,
      lineSource,
      p.coordinate,
      8,
    );
    refreshHover(hit);
  });

  map.on('pointermove', (evt) => {
    const [lon, lat] = transform(evt.coordinate, 'EPSG:3857', 'EPSG:4326');
    pendingPointer = { coordinate: evt.coordinate, lon, lat };
    pointerScheduler.schedule();
  });

  map.on('pointerdrag', () => {
    refreshDraggedFeatureVisual();
    applyLinkedLineDrag();
  });

  const viewport = map.getViewport();
  const onViewportLeave = () => {
    refreshHover(null);
    placementPreviewSourceRef.current.clear();
    onPointerLeaveRef.current?.();
  };
  viewport.addEventListener('mouseleave', onViewportLeave);
  viewport.addEventListener('contextmenu', onLineContextMenu, true);
  viewport.addEventListener('pointerdown', onLinePointerDown, true);

  return {
    cancelPointer: () => pointerScheduler.cancel(),
    removeViewportListeners: () => {
      viewport.removeEventListener('mouseleave', onViewportLeave);
      viewport.removeEventListener('contextmenu', onLineContextMenu, true);
      viewport.removeEventListener('pointerdown', onLinePointerDown, true);
    },
  };
}
