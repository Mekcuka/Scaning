import type { MapHitHelpers } from './mapHitHelpers';
import type { MapSetupContext } from './mapSetupContext';
import { createRefreshDraggedFeatureVisual } from './modifyHandlers/helpers';
import { bindModifyEndHandler } from './modifyHandlers/onModifyEnd';
import { bindModifyStartHandler } from './modifyHandlers/onModifyStart';

export function setupModifyHandlers(
  ctx: MapSetupContext,
  hitHelpers: MapHitHelpers,
  applyLinkedLineDrag: () => void,
): { refreshDraggedFeatureVisual: () => void } {
  const { refs, interactions } = ctx;
  const { select, modify } = interactions;
  const { editModeRef, pointLayerRef, nodePointLayerRef, lineLayerRef } = refs;

  bindModifyStartHandler(ctx, modify);
  bindModifyEndHandler(ctx, modify, hitHelpers);

  const refreshDraggedFeatureVisual = createRefreshDraggedFeatureVisual({
    select,
    editModeRef,
    pointLayerRef,
    nodePointLayerRef,
    lineLayerRef,
  });

  modify.on('modifying', () => {
    refreshDraggedFeatureVisual();
    applyLinkedLineDrag();
  });

  return { refreshDraggedFeatureVisual };
}
