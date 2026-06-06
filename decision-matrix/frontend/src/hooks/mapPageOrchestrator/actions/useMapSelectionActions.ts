import { nextPoiAutoName } from '../../../lib/poiParams';
import { useAppStore } from '../../../store';
import { useMapClipboard } from '../../useMapClipboard';
import { useMapDeleteSelection } from '../../useMapDeleteSelection';
import { useMapGeometrySave } from '../../useMapGeometrySave';
import type { MapPageActionsParams } from '../mapPageActionsTypes';

export function useMapSelectionActions(params: MapPageActionsParams) {
  const { projectId, canWriteProject, canWriteInfra, edit, data } = params;
  const pushToast = useAppStore((s) => s.pushToast);
  const effectiveProjectId = projectId ?? undefined;
  const {
    pois,
    infraObjects,
    pushUndo,
    invalidateMap,
    removeInfraFromCaches,
    touchInfraOverlay,
    upsertInfraInCache,
    nextAutoName,
  } = data;

  const geometry = useMapGeometrySave({
    projectId: effectiveProjectId,
    pois,
    infraObjects,
    pushUndo,
    pushToast,
    invalidateMap,
    touchInfraOverlay,
  });

  const deleteSelection = useMapDeleteSelection({
    projectId: effectiveProjectId,
    pois,
    infraObjects,
    canWriteProject,
    canWriteInfra,
    featureSel: edit.featureSel,
    featureGroupSel: edit.featureGroupSel,
    setFeatureSel: edit.setFeatureSel,
    setFeatureGroupSel: edit.setFeatureGroupSel,
    pushUndo,
    pushToast,
    invalidateMap,
    removeInfraFromCaches,
  });

  const clipboard = useMapClipboard({
    projectId: effectiveProjectId,
    pois,
    infraObjects,
    canWriteProject,
    canWriteInfra,
    mapEditEnabled: edit.mapEditEnabled,
    selectMode: edit.selectMode,
    featureSel: edit.featureSel,
    featureGroupSel: edit.featureGroupSel,
    mapClipboard: edit.mapClipboard,
    setMapClipboard: edit.setMapClipboard,
    pasteMode: edit.pasteMode,
    setPasteMode: edit.setPasteMode,
    setDrawMode: edit.setDrawMode,
    setSelectMode: edit.setSelectMode,
    setFeatureSel: edit.setFeatureSel,
    setFeatureGroupSel: edit.setFeatureGroupSel,
    geometrySavePending: geometry.geometrySavePending,
    setGeometrySavePending: geometry.setGeometrySavePending,
    cursor: edit.cursor,
    nextPoiAutoName,
    nextAutoName,
    upsertInfraInCache,
    pushUndo,
    invalidateMap,
    pushToast,
    requestDeleteSelection: deleteSelection.requestDeleteSelection,
    lineHealSkipIdsRef: edit.lineHealSkipIdsRef,
    canDeleteCurrentSelection: deleteSelection.canDeleteCurrentSelection,
  });

  return {
    ...geometry,
    ...deleteSelection,
    ...clipboard,
  };
}
