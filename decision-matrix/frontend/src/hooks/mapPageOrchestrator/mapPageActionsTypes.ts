import type { useMapLayerPreferences } from '../useMapLayerPreferences';
import type { MapDisplayMode } from '../useMapDisplayMode';
import type { useMapPageEditState } from './useMapPageEditState';
import type { useMapPageMapData } from './useMapPageMapData';
import type { useMapPageShellState } from './useMapPageShellState';

export type MapPageEditState = ReturnType<typeof useMapPageEditState>;
export type MapPageShellState = ReturnType<typeof useMapPageShellState>;
export type MapPageMapData = ReturnType<typeof useMapPageMapData>;

export type MapPageActionsParams = {
  projectId: string | null | undefined;
  mapRefreshNonce: number;
  canWriteProject: boolean;
  canWriteInfra: boolean;
  canEditMap: boolean;
  edit: MapPageEditState;
  shell: MapPageShellState;
  data: MapPageMapData;
  layerPrefs: ReturnType<typeof useMapLayerPreferences>['prefs'];
  setLayerPrefs: ReturnType<typeof useMapLayerPreferences>['setPrefs'];
  mapDisplayMode: MapDisplayMode;
  setMapDisplayMode: (mode: MapDisplayMode) => void;
  mapIn3d: boolean;
  requestAutoroadConfirm: ReturnType<
    typeof import('../useAutoroadConnectConfirm').useAutoroadConnectConfirm
  >['requestConfirm'];
  autoroadConfirmModal: ReturnType<
    typeof import('../useAutoroadConnectConfirm').useAutoroadConnectConfirm
  >['modal'];
};
