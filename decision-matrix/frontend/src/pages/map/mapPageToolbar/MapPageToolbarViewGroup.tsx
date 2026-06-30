import { Layers, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from 'antd';
import { MapDisplayModeToggle } from '../../../components/MapDisplayModeToggle';

import type { MapDisplayMode } from '../../../hooks/useMapDisplayMode';

export type MapPageToolbarViewGroupProps = {
  map3dFeatureEnabled: boolean;
  mapDisplayMode: MapDisplayMode;
  onDisplayModeChange: (mode: MapDisplayMode) => void;
  mapLayersOpen: boolean;
  onToggleLayers: () => void;
  mapFullscreen: boolean;
  onToggleFullscreen: () => void;
};

export function MapPageToolbarViewGroup({
  map3dFeatureEnabled,
  mapDisplayMode,
  onDisplayModeChange,
  mapLayersOpen,
  onToggleLayers,
  mapFullscreen,
  onToggleFullscreen,
}: MapPageToolbarViewGroupProps) {
  return (
    <div className="map-tools-group map-tools-group--view">
      {map3dFeatureEnabled && (
        <>
          <MapDisplayModeToggle mode={mapDisplayMode} onChange={onDisplayModeChange} />
          <div className="map-tools-sep map-display-mode-sep map-layers-toggle-sep" aria-hidden />
        </>
      )}
      <Button
        size="small"
        type={mapLayersOpen ? 'primary' : 'default'}
        className={`map-tool-btn map-tool-btn--with-label map-layers-toggle${mapLayersOpen ? ' active' : ''}`}
        title="Слои и настройки карты"
        aria-label="Слои и настройки карты"
        icon={<Layers size={14} className="shrink-0" aria-hidden />}
        onClick={onToggleLayers}
      >
        <span className="map-tool-label">Слои</span>
      </Button>
      <div className="map-tools-sep map-layers-toggle-sep map-fullscreen-sep" aria-hidden />
      <Button
        size="small"
        className="map-tool-btn map-fullscreen-toggle"
        title={mapFullscreen ? 'Выйти из полноэкранного режима' : 'Полноэкранная карта'}
        aria-label={mapFullscreen ? 'Выйти из полноэкранного режима' : 'Полноэкранная карта'}
        icon={mapFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        onClick={onToggleFullscreen}
      />
    </div>
  );
}
