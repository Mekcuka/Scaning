import { useAppStore } from '../../../store';
import { useMapAnalysis } from '../../useMapAnalysis';
import { useMapDetailSave } from '../../useMapDetailSave';
import type { MapPageActionsParams } from '../mapPageActionsTypes';

export function useMapAnalysisActions(params: MapPageActionsParams) {
  const { projectId, edit, data, layerPrefs } = params;
  const pushToast = useAppStore((s) => s.pushToast);
  const effectiveProjectId = projectId ?? undefined;
  const {
    selectedPoi,
    pois,
    infraObjects,
    layers,
    mapLayerVisibleInfra,
    distanceDefaults,
    detailSelection,
  } = data;
  const { radiusVisible } = layerPrefs;

  const analysis = useMapAnalysis({
    projectId: effectiveProjectId,
    selectedPoi,
    pois,
    infraObjects,
    layers,
    mapLayerVisibleInfra,
    radiusVisible,
    distanceDefaults,
    setMapFocus: edit.setMapFocus,
    pushToast,
    candidateSubtype: edit.candidateSubtype,
    setCandidateSubtype: edit.setCandidateSubtype,
    candidateParamType: edit.candidateParamType,
    setCandidateParamType: edit.setCandidateParamType,
  });

  const { saveDetailMut } = useMapDetailSave({
    projectId: effectiveProjectId,
    detailSelection,
    pushUndo: data.pushUndo,
    pushToast,
  });

  return {
    ...analysis,
    saveDetailMut,
  };
}
