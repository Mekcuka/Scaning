import { useAppStore } from '../../../store';
import { useMapInfraCreate } from '../../useMapInfraCreate';
import { useMapLineDrawing } from '../../useMapLineDrawing';
import type { MapPageActionsParams } from '../mapPageActionsTypes';

export function useMapDrawAndCreateActions(params: MapPageActionsParams) {
  const { projectId, mapRefreshNonce, canWriteInfra, edit, data, setLayerPrefs } = params;
  const clearLineDraftRef = edit.clearLineDraftRef;
  const clearDrawingForModeSwitchRef = edit.clearDrawingForModeSwitchRef;
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
    clearLineDraftRef,
    upsertInfraInCache,
    nextAutoName,
    pushUndo,
    pushToast,
    invalidateMap,
    lineHealSkipIdsRef: edit.lineHealSkipIdsRef,
    requestLineSplitConfirm: params.requestLineSplitConfirm,
  });

  const draw = useMapLineDrawing({
    projectId: effectiveProjectId,
    drawMode: edit.drawMode,
    infraSubtype: edit.infraForm.subtype,
    infraObjects,
    mapInFootprints: params.mapInFootprints,
    canWriteInfra,
    createInfraMut,
    pushToast,
    pushUndo,
    upsertInfraInCache,
    nextAutoName,
    setFeatureSel: edit.setFeatureSel,
    requestLineSplitConfirm: params.requestLineSplitConfirm,
  });

  clearLineDraftRef.current = draw.clearLineDraft;
  clearDrawingForModeSwitchRef.current = draw.clearDrawingForModeSwitch;

  return {
    createPoiMut,
    placeInfraPointAt,
    ...draw,
    needsDrawCursor: draw.needsDrawCursor,
  };
}
