import type { MapViewRefs } from './mapViewRefs';
import { bindDragPan } from './bindDragPan';
import { createMapLayers } from './createMapLayers';
import { createOlMap } from './createOlMap';
import { createMapDrawHandlers } from './mapDrawHandlers';
import { createMapHitHelpers } from './mapHitHelpers';
import type { MapSetupContext } from './mapSetupContext';
import { setupMapClickHandlers } from './setupMapClickHandlers';
import { setupModifyHandlers } from './setupModifyHandlers';
import { setupPointerHandlers } from './setupPointerHandlers';
import { setupSelectInteractions } from './setupSelectInteractions';
import { setupTranslateHandlers } from './setupTranslateHandlers';
import { setupViewHandlers } from './setupViewHandlers';

export function setupOpenLayersMap(refs: MapViewRefs, options: { showBasemap: boolean }): () => void {
  const { containerRef, mapRef, basemapLayerRef, cursorMeasureOverlayRef, anchorMeasureOverlaysRef } =
    refs;
  const { showBasemap } = options;

  if (!containerRef.current) return () => {};

  const layers = createMapLayers(refs, showBasemap);
  const map = createOlMap(refs, layers);
  const dragPan = bindDragPan(map, refs);

  const ctx: MapSetupContext = {
    refs,
    layers,
    interactions: {
      map,
      select: null!,
      modify: null!,
      translate: null!,
      dragBox: null!,
      dragPan,
    },
  };

  const { select, modify, dragBox } = setupSelectInteractions(ctx);
  ctx.interactions.select = select;
  ctx.interactions.modify = modify;
  ctx.interactions.dragBox = dragBox;

  const hitHelpers = createMapHitHelpers(map, refs);
  const { translate, applyLinkedLineDrag } = setupTranslateHandlers(ctx);
  ctx.interactions.translate = translate;

  const { refreshDraggedFeatureVisual } = setupModifyHandlers(ctx, hitHelpers, applyLinkedLineDrag);

  const drawHandlers = createMapDrawHandlers(ctx, hitHelpers);
  setupMapClickHandlers(ctx, hitHelpers, drawHandlers);

  const pointerCleanup = setupPointerHandlers(ctx, {
    refreshDraggedFeatureVisual,
    applyLinkedLineDrag,
    onLineContextMenu: drawHandlers.onLineContextMenu,
    onLinePointerDown: drawHandlers.onLinePointerDown,
  });
  const viewCleanup = setupViewHandlers(ctx);

  return () => {
    pointerCleanup.cancelPointer();
    viewCleanup.clearBboxTimer();
    viewCleanup.disconnectResize();
    pointerCleanup.removeViewportListeners();
    containerRef.current?.querySelector('.ol-fit-view')?.remove();
    map.setTarget(undefined);
    map.dispose();
    mapRef.current = null;
    basemapLayerRef.current = null;
    // Orphaned OL overlays must not be reused on the next map instance (StrictMode / 2D↔3D toggle).
    cursorMeasureOverlayRef.current = null;
    anchorMeasureOverlaysRef.current = [];
  };
}
