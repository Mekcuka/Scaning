import type { MapPageCanvasProps } from '../../../pages/map/MapPageCanvas';
import type { MapPageFooterProps } from '../../../pages/map/MapPageFooter';
import type { MapPageLayersSidebarProps } from '../../../pages/map/MapPageLayersSidebar';
import type { MapPageModalsProps } from '../../../pages/map/MapPageModals';
import type { MapPageSidePanelsProps } from '../../../pages/map/MapPageSidePanels';
import type { MapPageToolbarProps } from '../../../pages/map/mapPageToolbar/types';
import type { WellTrajectoryGeoJsonFeature } from '../../../lib/api/wellTrajectoryApi';
import type { MapDisplayMode } from '../../useMapDisplayMode';
import type { useMapLayerPreferences } from '../../useMapLayerPreferences';
import type { useMapPageEditState } from '../useMapPageEditState';
import type { useMapPageMapData } from '../useMapPageMapData';
import type { useMapPageShellState } from '../useMapPageShellState';

export type EditState = ReturnType<typeof useMapPageEditState>;
export type ShellState = ReturnType<typeof useMapPageShellState>;
export type MapData = ReturnType<typeof useMapPageMapData>;
export type MapActions = ReturnType<typeof useMapPageMapActions>;

export type MapPageSections = {
  toolbar: MapPageToolbarProps;
  layersSidebar: MapPageLayersSidebarProps;
  canvas: MapPageCanvasProps;
  sidePanels: MapPageSidePanelsProps;
  footer: MapPageFooterProps;
  modals: MapPageModalsProps;
};

export type BuildMapPageSectionsParams = {
  projectId: string | null | undefined;
  canWriteProject: boolean;
  canWriteInfra: boolean;
  canEditMap: boolean;
  layerPrefs: ReturnType<typeof useMapLayerPreferences>['prefs'];
  setLayerPrefs: ReturnType<typeof useMapLayerPreferences>['setPrefs'];
  patchLayerPrefs: ReturnType<typeof useMapLayerPreferences>['patchPrefs'];
  setLayerOpenSections: ReturnType<typeof useMapLayerPreferences>['setOpenSections'];
  showBasemap: boolean;
  showModels: boolean;
  showPoisOnMap: boolean;
  showRadii: boolean;
  radiusVisible: ReturnType<typeof useMapLayerPreferences>['prefs']['radiusVisible'];
  layerOpenSections: ReturnType<typeof useMapLayerPreferences>['prefs']['openSections'];
  map3dFeatureEnabled: boolean;
  mapDisplayMode: MapDisplayMode;
  mapInFootprints: boolean;
  mapIn3d: boolean;
  shell: ShellState;
  edit: EditState;
  data: MapData;
  actions: MapActions;
  wellTrajectoryFeatures: WellTrajectoryGeoJsonFeature[];
};
