import { transform } from 'ol/proj';
import Point from 'ol/geom/Point';
import { resolveHoverFeatureIdAtCoordinate, resolveInfraPointAtCoordinate, resolveFootprintHoverIdAtCoordinate } from '../../lib/mapHitTest';
import { createPointerFrameScheduler, pointerCoordsChanged } from '../../lib/mapPointerThrottle';
import { MAP_POINT_HIT_TOLERANCE_PX } from './constants';
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
  const { refs, layers, interactions } = ctx;
  const { map } = interactions;
  const { pointLayer, nodePointLayer, lineLayer } = layers;
  const {
    containerRef,
    pointSourceRef,
    nodePointSourceRef,
    lineSourceRef,
    padFootprintSourceRef,
    padFootprintLayerRef,
    infraSymbologyRef,
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
    const nodePointSource = nodePointSourceRef.current;
    const lineSource = lineSourceRef.current;

    const invalidateHover = (id: string | null) => {
      if (!id) return;
      const f = findSelectableLayerFeature(pointSource, lineSource, id, nodePointSource);
      if (!f) return;
      f.changed();
      const geom = f.getGeometry();
      if (geom instanceof Point) {
        const onNodeLayer = nodePointSource.getFeatures().includes(f);
        (onNodeLayer ? nodePointLayer : pointLayer).changed();
      } else {
        lineLayer.changed();
      }
    };

    if (prev) invalidateHover(prev);
    hoveredIdRef.current = hit;
    if (hit) invalidateHover(hit);
    if (infraSymbologyRef.current === 'footprints') {
      padFootprintLayerRef.current?.changed();
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
    const nodePointSource = nodePointSourceRef.current;
    const lineSource = lineSourceRef.current;
    const overPoint = resolveInfraPointAtCoordinate(
      map,
      pointSource,
      p.coordinate,
      20,
      nodePointSource,
    );
    if (pointerCoordsChanged(lastPointerLonLatRef.current, p.lon, p.lat)) {
      lastPointerLonLatRef.current = { lon: p.lon, lat: p.lat };
      onPointerMoveRef.current?.(
        p.lon,
        p.lat,
        overPoint ? { lon: overPoint.lon, lat: overPoint.lat } : undefined,
      );
    }
    let hit = resolveHoverFeatureIdAtCoordinate(
      map,
      pointSource,
      lineSource,
      p.coordinate,
      MAP_POINT_HIT_TOLERANCE_PX,
      nodePointSource,
    );
    if (!hit && infraSymbologyRef.current === 'footprints') {
      hit = resolveFootprintHoverIdAtCoordinate(
        map,
        padFootprintSourceRef.current,
        p.coordinate,
        MAP_POINT_HIT_TOLERANCE_PX,
      );
    }
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
