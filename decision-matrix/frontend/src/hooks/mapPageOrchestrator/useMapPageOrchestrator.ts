import { useAutoroadConnectConfirm } from '../useAutoroadConnectConfirm';
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

export type { MapPageSections } from './buildMapPageSections/index';

export function useMapPageOrchestrator() {
  const { canWriteProject, canWriteInfra } = usePermissions();
  const { requestConfirm: requestAutoroadConfirm, modal: autoroadConfirmModal } =
    useAutoroadConnectConfirm();
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
    showTerrain,
    showModels,
    showPoisOnMap,
    showRadii,
    radiusVisible,
    openSections: layerOpenSections,
  } = layerPrefs;
  const {
    is3dEnabled: map3dFeatureEnabled,
    displayMode: mapDisplayMode,
    setDisplayMode: setMapDisplayMode,
    mapIn3d,
  } = useMapDisplayMode();

  const shell = useMapPageShellState();
  const edit = useMapPageEditState(canEditMap, canWriteProject, canWriteInfra);
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
    requestAutoroadConfirm,
    autoroadConfirmModal,
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
    showTerrain,
    showModels,
    showPoisOnMap,
    showRadii,
    radiusVisible,
    layerOpenSections,
    map3dFeatureEnabled,
    mapDisplayMode,
    mapIn3d,
    shell,
    edit,
    data,
    actions,
  });

  return {
    projectId,
    autoroadConfirmModal,
    mapCanvasRef: shell.mapCanvasRef,
    sections,
  };
}
