import { useCallback, useEffect } from 'react';
import { useSyncAssistantUiContext } from '../../lib/assistant/assistantContext';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { buildMapFitAllFocus } from '../../lib/analysisDisplay';
import { setProjectCustomGltfAssets } from '../../lib/map3d/map3dCustomAssets';
import { clearGltfPrototypeCache } from '../../lib/map3d/map3dGltfLoader';
import {
  defaultMapDataApi,
  defaultProjectsMapSettingsApi,
  type MapDataApiPort,
  type ProjectsMapSettingsApiPort,
} from '../../lib/api';
import { useMapInfraData } from '../useMapInfraData';
import { useMapSearchFilter } from '../useMapSearchFilter';
import { useMapSelection } from '../useMapSelection';
import { useProjectLayers, useProjectPois } from '../useProjectData';
import { useProjectJobBusy } from '../useProjectJobBusy';
import { refreshMapQueries } from '../../lib/mapQueries';
import { queryKeys } from '../../lib/queryKeys';
import { useMapUndo } from '../../lib/mapUndo';
import { drainPendingMapUndos } from '../../lib/pendingMapUndoBridge';
import type { useMapPageEditState } from './useMapPageEditState';
import type { useMapLayerPreferences } from '../useMapLayerPreferences';

type EditState = ReturnType<typeof useMapPageEditState>;
type LayerPrefs = ReturnType<typeof useMapLayerPreferences>['prefs'];

export function useMapPageMapData(params: {
  projectId: string | null | undefined;
  edit: EditState;
  layerPrefs: LayerPrefs;
  setLayerPrefs: ReturnType<typeof useMapLayerPreferences>['setPrefs'];
  pushToast: (type: 'error' | 'info' | 'success', message: string) => void;
  mapDataApi?: MapDataApiPort;
  mapSettingsApi?: ProjectsMapSettingsApiPort;
}) {
  const {
    projectId,
    edit,
    layerPrefs,
    setLayerPrefs,
    pushToast,
    mapDataApi = defaultMapDataApi,
    mapSettingsApi = defaultProjectsMapSettingsApi,
  } = params;
  const effectiveProjectId = projectId ?? undefined;
  const { showPoisOnMap, subtypeFilter } = layerPrefs;
  const queryClient = useQueryClient();

  const { data: pois = [] } = useProjectPois(projectId);
  const projectJobBusy = useProjectJobBusy(projectId);

  useEffect(() => {
    if (pois.length > 0 && !edit.selectedPoiId) edit.setSelectedPoiId(pois[0].id);
  }, [pois, edit]);

  const { data: distanceDefaults } = useQuery({
    queryKey: ['distance-defaults', projectId],
    queryFn: () => mapSettingsApi.getDistanceDefaults(projectId!),
    enabled: !!projectId,
  });

  const { data: layers = [] } = useProjectLayers(projectId);

  const layerVisibilityMut = useMutation({
    mutationFn: ({ layerId, is_visible }: { layerId: string; is_visible: boolean }) =>
      mapDataApi.updateLayer(projectId!, layerId, { is_visible }),
    onSuccess: () => {
      if (projectId) queryClient.invalidateQueries({ queryKey: queryKeys.layers(projectId) });
    },
  });

  const setGroupSubtypesVisible = useCallback(
    (subtypes: readonly string[], visible: boolean) => {
      setLayerPrefs((prev) => {
        const subtypeFilter = { ...prev.subtypeFilter };
        for (const st of subtypes) subtypeFilter[st] = visible;
        return { ...prev, subtypeFilter };
      });
    },
    [setLayerPrefs],
  );

  const isGroupVisible = useCallback(
    (subtypes: readonly string[]) => subtypes.every((st) => subtypeFilter[st] !== false),
    [subtypeFilter],
  );

  const {
    infraObjects,
    mapInfraSource,
    mapBbox,
    handleMapBboxChange,
    resetInfraViewport,
    upsertInfraInCache,
    removeInfraFromCaches,
    touchInfraOverlay,
  } = useMapInfraData({
    projectId: effectiveProjectId,
    mapEditEnabled: edit.mapEditEnabled,
    featureSel: edit.featureSel,
    featureGroupSel: edit.featureGroupSel,
    pushToast,
  });

  const { data: map3dCustomModels = [] } = useQuery({
    queryKey: ['map3d-custom-models', projectId],
    queryFn: () => mapDataApi.listMap3dCustomModels(projectId!),
    enabled: !!projectId,
  });

  useEffect(() => {
    if (!projectId) {
      setProjectCustomGltfAssets('', []);
      clearGltfPrototypeCache();
      return;
    }
    setProjectCustomGltfAssets(projectId, map3dCustomModels);
    clearGltfPrototypeCache();
  }, [projectId, map3dCustomModels]);

  const {
    searchSuggestions,
    pickSearchResult,
    nextAutoName,
    mapLayerVisibleInfra,
    filteredInfra,
  } = useMapSearchFilter({
    projectId: effectiveProjectId,
    mapInfraSource,
    searchQ: edit.searchQ,
    pois,
    infraObjects,
    layers,
    subtypeFilter,
    setSearchQ: edit.setSearchQ,
    setSearchOpen: edit.setSearchOpen,
    setDrawMode: edit.setDrawMode,
    setPointMenuOpen: edit.setPointMenuOpen,
    setLineMenuOpen: edit.setLineMenuOpen,
    setSelectedPoiId: edit.setSelectedPoiId,
    setFeatureSel: edit.setFeatureSel,
  });

  const selectedPoi = pois.find((p) => p.id === edit.selectedPoiId) ?? pois[0] ?? null;

  useSyncAssistantUiContext({
    selectedPoiId: selectedPoi?.id ?? null,
    selectedPoiName: selectedPoi?.name ?? null,
  });

  const { groupSelectionDetails, detailSelection } = useMapSelection({
    featureSel: edit.featureSel,
    featureGroupSel: edit.featureGroupSel,
    pois,
    infraObjects,
  });

  const handleFitMapView = useCallback(() => {
    const visiblePois = showPoisOnMap ? pois : [];
    const focus = buildMapFitAllFocus(visiblePois, filteredInfra);
    if (!focus) {
      pushToast('info', 'На карте нет объектов для отображения');
      return;
    }
    edit.setMapFocus({ ...focus, nonce: Date.now() });
  }, [pois, filteredInfra, showPoisOnMap, pushToast, edit]);

  const invalidateMap = () => {
    if (!projectId) return;
    resetInfraViewport();
    queryClient.invalidateQueries({ queryKey: queryKeys.pois(projectId) });
    void refreshMapQueries(queryClient, projectId);
  };

  const { pushUndo, performUndo, canUndo, lastUndoMessage, setLastUndoMessage } = useMapUndo({
    projectId: effectiveProjectId,
    enabled: !!projectId,
    queryClient,
    invalidateMap,
    onUndoError: (msg) => pushToast('error', msg),
  });

  useEffect(() => {
    if (!effectiveProjectId) return;
    for (const entry of drainPendingMapUndos(effectiveProjectId)) {
      pushUndo(entry);
    }
  }, [effectiveProjectId, pushUndo]);

  useEffect(() => {
    if (!lastUndoMessage) return;
    pushToast('info', lastUndoMessage);
    setLastUndoMessage(null);
  }, [lastUndoMessage, setLastUndoMessage, pushToast]);

  return {
    pois,
    layers,
    distanceDefaults,
    projectJobBusy,
    layerVisibilityMut,
    setGroupSubtypesVisible,
    isGroupVisible,
    infraObjects,
    mapInfraSource,
    mapBbox,
    handleMapBboxChange,
    upsertInfraInCache,
    removeInfraFromCaches,
    touchInfraOverlay,
    map3dCustomModels,
    searchSuggestions,
    pickSearchResult,
    nextAutoName,
    mapLayerVisibleInfra,
    filteredInfra,
    selectedPoi,
    groupSelectionDetails,
    detailSelection,
    handleFitMapView,
    invalidateMap,
    pushUndo,
    performUndo,
    canUndo,
  };
}
