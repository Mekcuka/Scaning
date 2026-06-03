import { useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, X } from 'lucide-react';
import { LAYER_VISIBILITY_GROUPS } from '../lib/api';
import type { MapDisplayMode } from '../hooks/useMapDisplayMode';
import type { MapLayerOpenSections } from '../lib/mapLayerPreferences';
import { MapDisplayModeToggle } from './MapDisplayModeToggle';

type LayerRow = { id: string; name: string; is_visible: boolean };

type ThresholdMeta = { subtype: string; color: string; label: string; defaultKm: number };

type MapLayersPanelProps = {
  layers: LayerRow[];
  isGroupVisible: (subtypes: readonly string[]) => boolean;
  onGroupVisibility: (subtypes: readonly string[], visible: boolean) => void;
  onLayerVisibility: (layerId: string, visible: boolean) => void;
  layerVisibilityPending?: boolean;
  showPoisOnMap: boolean;
  onShowPoisChange: (visible: boolean) => void;
  showRadii: boolean;
  onShowRadiiChange: (visible: boolean) => void;
  radiusVisible: Record<string, boolean>;
  onRadiusVisibleChange: (subtype: string, visible: boolean) => void;
  thresholdMeta: ThresholdMeta[];
  thresholdKm: (subtype: string, fallback: number) => number;
  showBasemap: boolean;
  onShowBasemapChange: (visible: boolean) => void;
  /** 3D terrain (MapTiler DEM); only when 3D mode and key present. */
  showTerrain?: boolean;
  onShowTerrainChange?: (visible: boolean) => void;
  terrainToggleEnabled?: boolean;
  terrainToggleHint?: string;
  /** Procedural 3D models (point objects). */
  showModels?: boolean;
  onShowModelsChange?: (visible: boolean) => void;
  modelsToggleEnabled?: boolean;
  /** When true, layer visibility toggles are disabled (persisted server-side). */
  layerVisibilityReadOnly?: boolean;
  /** Persisted accordion state (optional controlled mode). */
  openSections?: MapLayerOpenSections;
  onOpenSectionsChange?: (sections: MapLayerOpenSections) => void;
  onClose?: () => void;
  /** When set, show 2D|3D switch in the panel header (desktop sidebar). */
  mapDisplayMode?: MapDisplayMode;
  onMapDisplayModeChange?: (mode: MapDisplayMode) => void;
};

function Section({
  id,
  title,
  open,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  open: boolean;
  onToggle: (id: string) => void;
  children: ReactNode;
}) {
  return (
    <section className="map-layers-section">
      <button
        type="button"
        className="map-layers-section-head"
        aria-expanded={open}
        onClick={() => onToggle(id)}
      >
        <span className="map-layers-section-chevron" aria-hidden>
          {open ? <ChevronDown size={14} strokeWidth={1.75} /> : <ChevronRight size={14} strokeWidth={1.75} />}
        </span>
        <span className="map-layers-section-title">{title}</span>
      </button>
      {open ? <div className="map-layers-section-body">{children}</div> : null}
    </section>
  );
}

export function MapLayersPanel({
  layers,
  isGroupVisible,
  onGroupVisibility,
  onLayerVisibility,
  layerVisibilityPending,
  showPoisOnMap,
  onShowPoisChange,
  showRadii,
  onShowRadiiChange,
  radiusVisible,
  onRadiusVisibleChange,
  thresholdMeta,
  thresholdKm,
  showBasemap,
  onShowBasemapChange,
  showTerrain = false,
  onShowTerrainChange,
  terrainToggleEnabled = false,
  terrainToggleHint,
  showModels = true,
  onShowModelsChange,
  modelsToggleEnabled = false,
  layerVisibilityReadOnly = false,
  openSections: openSectionsProp,
  onOpenSectionsChange,
  onClose,
  mapDisplayMode,
  onMapDisplayModeChange,
}: MapLayersPanelProps) {
  const [openSectionsLocal, setOpenSectionsLocal] = useState<MapLayerOpenSections>({
    basemap: true,
    objects: false,
    sources: false,
    radii: false,
  });
  const openSections = openSectionsProp ?? openSectionsLocal;

  const toggleSection = (id: string) => {
    const key = id as keyof MapLayerOpenSections;
    const next = { ...openSections, [key]: !openSections[key] };
    if (onOpenSectionsChange) onOpenSectionsChange(next);
    else setOpenSectionsLocal(next);
  };

  const allGroupSubtypes = useMemo(
    () => LAYER_VISIBILITY_GROUPS.flatMap((g) => g.subtypes),
    []
  );

  return (
    <div className="map-layers-panel">
      <div className="map-layers-panel-head">
        <h3 className="map-layers-panel-title">Слои</h3>
        {mapDisplayMode != null && onMapDisplayModeChange ? (
          <MapDisplayModeToggle mode={mapDisplayMode} onChange={onMapDisplayModeChange} />
        ) : null}
        {onClose ? (
          <button
            type="button"
            className="btn btn-ghost p-1 shrink-0 map-layers-close"
            aria-label="Закрыть"
            onClick={onClose}
          >
            <X size={15} strokeWidth={1.75} />
          </button>
        ) : null}
      </div>

      <Section
        id="basemap"
        title="Подложка"
        open={openSections.basemap ?? true}
        onToggle={toggleSection}
      >
        <label className="map-layers-item">
          <span className="map-layers-item-label">Спутник</span>
          <input type="checkbox" checked={showBasemap} onChange={(e) => onShowBasemapChange(e.target.checked)} />
        </label>
        {onShowTerrainChange ? (
          <label
            className={`map-layers-item map-layers-item--indent${!terrainToggleEnabled ? ' map-layers-item--disabled' : ''}`}
            title={terrainToggleHint}
          >
            <span className="map-layers-item-label">Рельеф (3D)</span>
            <input
              type="checkbox"
              checked={showTerrain}
              disabled={!terrainToggleEnabled}
              onChange={(e) => onShowTerrainChange(e.target.checked)}
            />
          </label>
        ) : null}
        {onShowModelsChange ? (
          <label
            className={`map-layers-item map-layers-item--indent${!modelsToggleEnabled ? ' map-layers-item--disabled' : ''}`}
          >
            <span className="map-layers-item-label">3D-модели объектов</span>
            <input
              type="checkbox"
              checked={showModels}
              disabled={!modelsToggleEnabled}
              onChange={(e) => onShowModelsChange(e.target.checked)}
            />
          </label>
        ) : null}
      </Section>

      <Section
        id="objects"
        title="Объекты"
        open={openSections.objects ?? false}
        onToggle={toggleSection}
      >
        <div className="map-layers-bulk">
          <button type="button" className="map-layers-link" onClick={() => onGroupVisibility(allGroupSubtypes, true)}>
            Все
          </button>
          <span className="map-layers-bulk-sep" aria-hidden>
            ·
          </span>
          <button type="button" className="map-layers-link" onClick={() => onGroupVisibility(allGroupSubtypes, false)}>
            Скрыть
          </button>
        </div>

        {LAYER_VISIBILITY_GROUPS.map((group) => (
          <label key={group.id} className="map-layers-item">
            <span className="map-layers-item-label truncate" title={group.label}>
              {group.label}
            </span>
            <input
              type="checkbox"
              checked={isGroupVisible(group.subtypes)}
              onChange={(e) => onGroupVisibility(group.subtypes, e.target.checked)}
            />
          </label>
        ))}

        <label className="map-layers-item map-layers-item--sep">
          <span className="map-layers-item-label">Точки интереса</span>
          <input type="checkbox" checked={showPoisOnMap} onChange={(e) => onShowPoisChange(e.target.checked)} />
        </label>
      </Section>

      <Section
        id="sources"
        title="Источники"
        open={openSections.sources ?? false}
        onToggle={toggleSection}
      >
        {layers.length === 0 ? (
          <p className="map-layers-empty">Нет импортированных слоёв</p>
        ) : (
          layers.map((layer) => (
            <label key={layer.id} className="map-layers-item">
              <span className="map-layers-item-label truncate" title={layer.name}>
                {layer.name}
              </span>
              <input
                type="checkbox"
                checked={layer.is_visible}
                disabled={layerVisibilityPending || layerVisibilityReadOnly}
                onChange={(e) => onLayerVisibility(layer.id, e.target.checked)}
              />
            </label>
          ))
        )}
      </Section>

      <Section
        id="radii"
        title="Радиусы"
        open={openSections.radii ?? false}
        onToggle={toggleSection}
      >
        <label className="map-layers-item">
          <span className="map-layers-item-label">Все радиусы</span>
          <input type="checkbox" checked={showRadii} onChange={(e) => onShowRadiiChange(e.target.checked)} />
        </label>
        {thresholdMeta.map((m) => (
          <label
            key={m.subtype}
            className={`map-layers-item map-layers-item--indent${!showRadii ? ' map-layers-item--disabled' : ''}`}
          >
            <span className="map-layers-item-label truncate">
              <span className="layer-swatch" style={{ background: m.color }} aria-hidden />
              {m.label}
              <span className="map-layers-km">{thresholdKm(m.subtype, m.defaultKm)} км</span>
            </span>
            <input
              type="checkbox"
              checked={radiusVisible[m.subtype] ?? true}
              disabled={!showRadii}
              onChange={(e) => onRadiusVisibleChange(m.subtype, e.target.checked)}
            />
          </label>
        ))}
      </Section>
    </div>
  );
}
