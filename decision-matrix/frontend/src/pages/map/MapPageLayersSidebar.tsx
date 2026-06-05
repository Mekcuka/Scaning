import { MapLayersPanel } from '../../components/MapLayersPanel';
import { isMaptilerTerrainAvailable } from '../../lib/map3d/map3dConfig';
import type { InfraLayer } from '../../lib/api';
import type { MapLayerOpenSections } from '../../lib/mapLayerPreferences';
import { THRESHOLD_META } from './mapConstants';

export type MapPageLayersSidebarProps = {
  open: boolean;
  onClose: () => void;
  layers: InfraLayer[];
  isGroupVisible: (subtypes: readonly string[]) => boolean;
  onGroupVisibility: (subtypes: readonly string[], visible: boolean) => void;
  onLayerVisibility: (layerId: string, is_visible: boolean) => void;
  layerVisibilityReadOnly: boolean;
  layerVisibilityPending: boolean;
  showPoisOnMap: boolean;
  onShowPoisChange: (visible: boolean) => void;
  showRadii: boolean;
  onShowRadiiChange: (visible: boolean) => void;
  radiusVisible: Record<string, boolean | undefined>;
  onRadiusVisibleChange: (subtype: string, visible: boolean) => void;
  openSections: MapLayerOpenSections;
  onOpenSectionsChange: (sections: MapLayerOpenSections) => void;
  thresholdKm: (subtype: string, fallback: number) => number;
  showBasemap: boolean;
  onShowBasemapChange: (visible: boolean) => void;
  showTerrain: boolean;
  onShowTerrainChange: (visible: boolean) => void;
  mapIn3d: boolean;
  showModels: boolean;
  onShowModelsChange: (visible: boolean) => void;
};

export function MapPageLayersSidebar({
  open,
  onClose,
  layers,
  isGroupVisible,
  onGroupVisibility,
  onLayerVisibility,
  layerVisibilityReadOnly,
  layerVisibilityPending,
  showPoisOnMap,
  onShowPoisChange,
  showRadii,
  onShowRadiiChange,
  radiusVisible,
  onRadiusVisibleChange,
  openSections,
  onOpenSectionsChange,
  thresholdKm,
  showBasemap,
  onShowBasemapChange,
  showTerrain,
  onShowTerrainChange,
  mapIn3d,
  showModels,
  onShowModelsChange,
}: MapPageLayersSidebarProps) {
  return (
    <>
      {open && (
        <button
          type="button"
          className="map-sidebar-backdrop"
          aria-label="Закрыть панель слоёв"
          onClick={onClose}
        />
      )}
      <aside className={`map-sidebar-panel${open ? ' map-sidebar-panel--open' : ''}`}>
        <MapLayersPanel
          layers={layers}
          isGroupVisible={isGroupVisible}
          onGroupVisibility={onGroupVisibility}
          onLayerVisibility={onLayerVisibility}
          layerVisibilityReadOnly={layerVisibilityReadOnly}
          layerVisibilityPending={layerVisibilityPending}
          showPoisOnMap={showPoisOnMap}
          onShowPoisChange={onShowPoisChange}
          showRadii={showRadii}
          onShowRadiiChange={onShowRadiiChange}
          radiusVisible={radiusVisible}
          onRadiusVisibleChange={onRadiusVisibleChange}
          openSections={openSections}
          onOpenSectionsChange={onOpenSectionsChange}
          thresholdMeta={THRESHOLD_META}
          thresholdKm={thresholdKm}
          showBasemap={showBasemap}
          onShowBasemapChange={onShowBasemapChange}
          showTerrain={showTerrain}
          onShowTerrainChange={onShowTerrainChange}
          terrainToggleEnabled={mapIn3d && isMaptilerTerrainAvailable()}
          terrainToggleHint={
            !isMaptilerTerrainAvailable()
              ? 'Задайте VITE_MAPTILER_KEY в frontend/.env'
              : !mapIn3d
                ? 'Доступно в режиме 3D'
                : undefined
          }
          showModels={showModels}
          onShowModelsChange={onShowModelsChange}
          modelsToggleEnabled={mapIn3d}
          onClose={onClose}
        />
      </aside>
    </>
  );
}
