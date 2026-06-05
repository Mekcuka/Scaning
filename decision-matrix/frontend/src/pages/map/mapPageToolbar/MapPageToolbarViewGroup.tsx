import { Layers, Maximize2, Minimize2 } from 'lucide-react';
import { MapDisplayModeToggle } from '../../../components/MapDisplayModeToggle';

export type MapPageToolbarViewGroupProps = {
  map3dFeatureEnabled: boolean;
  mapDisplayMode: '2d' | '3d';
  onDisplayModeChange: (mode: '2d' | '3d') => void;
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
      <button
        type="button"
        className={`btn btn-sm map-tool-btn map-tool-btn--with-label btn-secondary map-layers-toggle${
          mapLayersOpen ? ' btn-primary active' : ''
        }`}
        title="Слои и настройки карты"
        aria-label="Слои и настройки карты"
        onClick={onToggleLayers}
      >
        <Layers size={14} className="shrink-0" aria-hidden />
        <span className="map-tool-label">Слои</span>
      </button>
      <div className="map-tools-sep map-layers-toggle-sep map-fullscreen-sep" aria-hidden />
      <button
        type="button"
        className="btn btn-sm map-tool-btn btn-secondary map-fullscreen-toggle"
        title={mapFullscreen ? 'Выйти из полноэкранного режима' : 'Полноэкранная карта'}
        aria-label={mapFullscreen ? 'Выйти из полноэкранного режима' : 'Полноэкранная карта'}
        onClick={onToggleFullscreen}
      >
        {mapFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
      </button>
    </div>
  );
}
