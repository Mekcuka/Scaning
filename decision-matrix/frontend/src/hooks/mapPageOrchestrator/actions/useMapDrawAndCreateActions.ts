import { useAppStore } from '../../../store';
import { useMapInfraCreate } from '../../useMapInfraCreate';
import { useMapLineDrawing } from '../../useMapLineDrawing';
import type { MapPageActionsParams } from '../mapPageActionsTypes';

export function useMapDrawAndCreateActions(params: MapPageActionsParams) {
  const { projectId, mapRefreshNonce, canWriteInfra, edit, data, setLayerPrefs } = params;
  const pushToast = useAppStore((s) => s.pushToast);
  const effectiveProjectId = projectId ?? undefined;
  const {
    infraObjects,
    layers,
    upsertInfraInCache,
    nextAutoName,
    pushUndo,
    invalidateMap,
    layerVisibilityMut,
  } = data;

  const { createPoiMut, createInfraMut, placeInfraPointAt } = useMapInfraCreate({
    projectId: effectiveProjectId,
    mapRefreshNonce,
    canWriteInfra,
    infraObjects,
    layers,
    layerVisibilityMut,
    setLayerPrefs,
    setFeatureSel: edit.setFeatureSel,
    setModal: edit.setModal,
    setDrawMode: edit.setDrawMode,
    clearLineDraftRef: edit.clearLineDraftRef,
    upsertInfraInCache,
    nextAutoName,
    pushUndo,
    pushToast,
    invalidateMap,
    lineHealSkipIdsRef: edit.lineHealSkipIdsRef,
  });

  const draw = useMapLineDrawing({
    projectId: effectiveProjectId,
    drawMode: edit.drawMode,
    infraSubtype: edit.infraForm.subtype,
    infraObjects,
    canWriteInfra,
    createInfraMut,
    pushToast,
    pushUndo,
    upsertInfraInCache,
    nextAutoName,
    setFeatureSel: edit.setFeatureSel,
  });

  edit.clearLineDraftRef.current = draw.clearLineDraft;
  edit.clearDrawingForModeSwitchRef.current = draw.clearDrawingForModeSwitch;

  return {
    createPoiMut,
    placeInfraPointAt,
    ...draw,
    needsDrawCursor: draw.needsDrawCursor,
  };
}
