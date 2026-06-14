import { useEffect } from 'react';
import { useAutoroadConnectConfirm } from '../useAutoroadConnectConfirm';
import { useLineSplitConfirm } from '../useLineSplitConfirm';
import { useMapDisplayMode } from '../useMapDisplayMode';
import { useActiveProject } from '../useActiveProject';
import { useMapLayerPreferences } from '../useMapLayerPreferences';
import { usePermissions } from '../usePermissions';
import { useAppStore } from '../../store';
import { useMapPageEditState } from './useMapPageEditState';
import { useMapPageShellState } from './useMapPageShellState';
import { useMapPageMapData } from './useMapPageMapData';
import { useMapPageMapActions } from './useMapPageMapActions';
import { buildMapPageSections } from './buildMapPageSections/index';
import { useWellTrajectoryProjectGeoJson } from '../useWellTrajectoryGeoJson';

export type { MapPageSections } from './buildMapPageSections/index';

export function useMapPageOrchestrator() {
  const { canWriteProject, canWriteInfra } = usePermissions();
  const { requestConfirm: requestAutoroadConfirm, modal: autoroadConfirmModal } =
    useAutoroadConnectConfirm();
  const { requestConfirm: requestLineSplitConfirm, modal: lineSplitConfirmModal } =
    useLineSplitConfirm();
  const canEditMap = canWriteProject || canWriteInfra;
  const { projectId } = useActiveProject();
  const pushToast = useAppStore((s) => s.pushToast);
  const mapRefreshNonce = useAppStore((s) => s.mapRefreshNonce);
  const {
    prefs: layerPrefs,
    setPrefs: setLayerPrefs,
    patchPrefs: patchLayerPrefs,
    setOpenSections: setLayerOpenSections,
  } = useMapLayerPreferences(projectId ?? null);
  const {
    showBasemap,
    showModels,
    showPoisOnMap,
    showRadii,
    radiusVisible,
    openSections: layerOpenSections,
  } = layerPrefs;
  const wellTrajLayersEnabled =
    layerPrefs.showWellTrajectories || layerPrefs.showWellBottomholes || layerPrefs.showWellTrajectories3d;
  const { data: wellTrajectoryGeoJson } = useWellTrajectoryProjectGeoJson(
    projectId ?? null,
    wellTrajLayersEnabled,
  );
  const {
    is3dEnabled: map3dFeatureEnabled,
    displayMode: mapDisplayMode,
    setDisplayMode: setMapDisplayMode,
    mapIn3d,
    mapInFootprints,
  } = useMapDisplayMode();

  const shell = useMapPageShellState();
  const edit = useMapPageEditState(canEditMap, canWriteProject, canWriteInfra);

  useEffect(() => {
    if (!mapInFootprints) {
      edit.setFootprintLineConnectPickSubtype(null);
    }
  }, [mapInFootprints, edit]);

  const data = useMapPageMapData({ projectId, edit, layerPrefs, setLayerPrefs, pushToast });
  const actions = useMapPageMapActions({
    projectId,
    mapRefreshNonce,
    canWriteProject,
    canWriteInfra,
    canEditMap,
    edit,
    shell,
    data,
    layerPrefs,
    setLayerPrefs,
    mapDisplayMode,
    setMapDisplayMode,
    mapIn3d,
    mapInFootprints,
    requestAutoroadConfirm,
    autoroadConfirmModal,
    requestLineSplitConfirm,
    lineSplitConfirmModal,
  });

  const sections = buildMapPageSections({
    projectId,
    canWriteProject,
    canWriteInfra,
    canEditMap,
    layerPrefs,
    setLayerPrefs,
    patchLayerPrefs,
    setLayerOpenSections,
    showBasemap,
    showModels,
    showPoisOnMap,
    showRadii,
    radiusVisible,
    layerOpenSections,
    map3dFeatureEnabled,
    mapDisplayMode,
    mapIn3d,
    mapInFootprints,
    shell,
    edit,
    data,
    actions,
    wellTrajectoryFeatures: wellTrajectoryGeoJson?.features ?? [],
  });

  return {
    projectId,
    autoroadConfirmModal,
    lineSplitConfirmModal,
    mapCanvasRef: shell.mapCanvasRef,
    sections,
  };
}
