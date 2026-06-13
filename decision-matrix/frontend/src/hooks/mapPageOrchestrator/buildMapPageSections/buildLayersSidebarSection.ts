import type { MapPageLayersSidebarProps } from '../../../pages/map/MapPageLayersSidebar';
import type { BuildMapPageSectionsParams } from './types';

export function buildLayersSidebarSection(
  params: Pick<
    BuildMapPageSectionsParams,
    | 'canWriteInfra'
    | 'showPoisOnMap'
    | 'showRadii'
    | 'radiusVisible'
    | 'layerOpenSections'
    | 'showBasemap'
    | 'showModels'
    | 'mapIn3d'
    | 'setLayerPrefs'
    | 'setLayerOpenSections'
    | 'shell'
    | 'data'
    | 'actions'
  >,
): MapPageLayersSidebarProps {
  const {
    canWriteInfra,
    showPoisOnMap,
    showRadii,
    radiusVisible,
    layerOpenSections,
    showBasemap,
    showModels,
    mapIn3d,
    setLayerPrefs,
    setLayerOpenSections,
    shell,
    data,
    actions,
  } = params;

  return {
    open: shell.mapLayersOpen,
    onClose: () => shell.setMapLayersOpen(false),
    layers: data.layers,
    isGroupVisible: data.isGroupVisible,
    onGroupVisibility: data.setGroupSubtypesVisible,
    onLayerVisibility: (layerId, is_visible) =>
      data.layerVisibilityMut.mutate({ layerId, is_visible }),
    layerVisibilityReadOnly: !canWriteInfra,
    layerVisibilityPending: data.layerVisibilityMut.isPending,
    showPoisOnMap,
    onShowPoisChange: (visible) => setLayerPrefs((p) => ({ ...p, showPoisOnMap: visible })),
    showRadii,
    onShowRadiiChange: (visible) => setLayerPrefs((p) => ({ ...p, showRadii: visible })),
    radiusVisible,
    onRadiusVisibleChange: (subtype, visible) =>
      setLayerPrefs((p) => ({
        ...p,
        radiusVisible: { ...p.radiusVisible, [subtype]: visible },
      })),
    openSections: layerOpenSections,
    onOpenSectionsChange: setLayerOpenSections,
    thresholdKm: actions.thresholdKm,
    showBasemap,
    onShowBasemapChange: (visible) => setLayerPrefs((p) => ({ ...p, showBasemap: visible })),
    mapIn3d,
    showModels,
    onShowModelsChange: (visible) => setLayerPrefs((p) => ({ ...p, showModels: visible })),
    showWellTrajectories: params.layerPrefs.showWellTrajectories,
    onShowWellTrajectoriesChange: (visible) =>
      setLayerPrefs((p) => ({ ...p, showWellTrajectories: visible })),
    showWellBottomholes: params.layerPrefs.showWellBottomholes,
    onShowWellBottomholesChange: (visible) =>
      setLayerPrefs((p) => ({ ...p, showWellBottomholes: visible })),
    showWellTrajectories3d: params.layerPrefs.showWellTrajectories3d,
    onShowWellTrajectories3dChange: (visible) =>
      setLayerPrefs((p) => ({ ...p, showWellTrajectories3d: visible })),
  };
}
