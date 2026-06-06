import { useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, X } from 'lucide-react';
import {
  LAYER_VISIBILITY_GROUPS,
  LINE_LAYER_UI_ENTRIES,
  POINT_LAYER_UI_ENTRIES,
  type LayerVisibilityGroup,
  type LayerVisibilityUiEntry,
} from '../lib/api';
import type { MapLayerOpenSections } from '../lib/mapLayerPreferences';

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
  radiusVisible: Record<string, boolean | undefined>;
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
};

function LayerBulkActions({
  subtypes,
  onGroupVisibility,
}: {
  subtypes: readonly string[];
  onGroupVisibility: (subtypes: readonly string[], visible: boolean) => void;
}) {
  return (
    <div className="map-layers-pill-group" role="group">
      <button type="button" className="map-layers-pill" onClick={() => onGroupVisibility(subtypes, true)}>
        Все
      </button>
      <button type="button" className="map-layers-pill" onClick={() => onGroupVisibility(subtypes, false)}>
        Скрыть
      </button>
    </div>
  );
}

function LayerToggle({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <span className={`map-layers-switch${disabled ? ' map-layers-switch--disabled' : ''}`}>
      <input
        type="checkbox"
        className="map-layers-switch-input"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="map-layers-switch-track" aria-hidden />
    </span>
  );
}

function LayerGroupRow({
  group,
  indent = 'indent',
  isGroupVisible,
  onGroupVisibility,
}: {
  group: LayerVisibilityGroup;
  indent?: 'indent' | 'nested';
  isGroupVisible: (subtypes: readonly string[]) => boolean;
  onGroupVisibility: (subtypes: readonly string[], visible: boolean) => void;
}) {
  const indentClass = indent === 'nested' ? 'map-layers-item--nested' : 'map-layers-item--indent';
  const visible = isGroupVisible(group.subtypes);
  return (
    <label key={group.id} className={`map-layers-item ${indentClass}${visible ? '' : ' map-layers-item--off'}`}>
      <span className="map-layers-item-label truncate" title={group.label}>
        {group.label}
      </span>
      <LayerToggle
        checked={visible}
        onChange={(next) => onGroupVisibility(group.subtypes, next)}
      />
    </label>
  );
}

function ObjectCategorySection({
  title,
  entries,
  subtypes,
  isGroupVisible,
  onGroupVisibility,
}: {
  title: string;
  entries: readonly LayerVisibilityUiEntry[];
  subtypes: readonly string[];
  isGroupVisible: (subtypes: readonly string[]) => boolean;
  onGroupVisibility: (subtypes: readonly string[], visible: boolean) => void;
}) {
  return (
    <div className="map-layers-category">
      <div className="map-layers-category-head">
        <span className="map-layers-category-title">{title}</span>
        <LayerBulkActions subtypes={subtypes} onGroupVisibility={onGroupVisibility} />
      </div>
      {entries.map((entry) => {
        if (entry.kind === 'group') {
          return (
            <LayerGroupRow
              key={entry.group.id}
              group={entry.group}
              isGroupVisible={isGroupVisible}
              onGroupVisibility={onGroupVisibility}
            />
          );
        }
        return (
          <div key={entry.title} className="map-layers-subcategory">
            <div className="map-layers-subcategory-head">
              <span className="map-layers-subcategory-title">{entry.title}</span>
              <LayerBulkActions subtypes={entry.subtypes} onGroupVisibility={onGroupVisibility} />
            </div>
            {entry.groups.map((group) => (
              <LayerGroupRow
                key={group.id}
                group={group}
                indent="nested"
                isGroupVisible={isGroupVisible}
                onGroupVisibility={onGroupVisibility}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

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
    <section className={`map-layers-section${open ? ' map-layers-section--open' : ''}`}>
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

function LayerRow({
  label,
  checked,
  onChange,
  disabled = false,
  indent,
  offWhenUnchecked = true,
  title,
  children,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  indent?: 'indent' | 'nested' | 'none';
  offWhenUnchecked?: boolean;
  title?: string;
  children?: ReactNode;
}) {
  const indentClass =
    indent === 'nested'
      ? 'map-layers-item--nested'
      : indent === 'indent'
        ? 'map-layers-item--indent'
        : '';
  const offClass = offWhenUnchecked && !checked ? ' map-layers-item--off' : '';
  const disabledClass = disabled ? ' map-layers-item--disabled' : '';
  return (
    <label
      className={`map-layers-item ${indentClass}${offClass}${disabledClass}`.trim()}
      title={title}
    >
      <span className="map-layers-item-label truncate">
        {children ?? label}
      </span>
      <LayerToggle checked={checked} onChange={onChange} disabled={disabled} />
    </label>
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
    [],
  );

  const pointGroupSubtypes = useMemo(
    () => POINT_LAYER_UI_ENTRIES.flatMap((e) => (e.kind === 'group' ? e.group.subtypes : e.subtypes)),
    [],
  );

  const lineGroupSubtypes = useMemo(
    () => LINE_LAYER_UI_ENTRIES.flatMap((e) => (e.kind === 'group' ? e.group.subtypes : e.subtypes)),
    [],
  );

  return (
    <div className="map-layers-panel">
      <div className="map-layers-panel-head">
        <h3 className="map-layers-panel-title">Слои</h3>
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

      <div className="map-layers-panel-body">
      <Section
        id="basemap"
        title="Подложка"
        open={openSections.basemap ?? true}
        onToggle={toggleSection}
      >
        <LayerRow label="Спутник" checked={showBasemap} onChange={onShowBasemapChange} />
        {onShowTerrainChange ? (
          <LayerRow
            label="Рельеф (3D)"
            checked={showTerrain}
            onChange={onShowTerrainChange}
            disabled={!terrainToggleEnabled}
            indent="indent"
            title={terrainToggleHint}
          />
        ) : null}
        {onShowModelsChange ? (
          <LayerRow
            label="3D-модели объектов"
            checked={showModels}
            onChange={onShowModelsChange}
            disabled={!modelsToggleEnabled}
            indent="indent"
          />
        ) : null}
      </Section>

      <Section
        id="objects"
        title="Объекты"
        open={openSections.objects ?? false}
        onToggle={toggleSection}
      >
        <div className="map-layers-toolbar">
          <span className="map-layers-toolbar-label">Все объекты</span>
          <LayerBulkActions subtypes={allGroupSubtypes} onGroupVisibility={onGroupVisibility} />
        </div>

        <ObjectCategorySection
          title="Точечные объекты"
          entries={POINT_LAYER_UI_ENTRIES}
          subtypes={pointGroupSubtypes}
          isGroupVisible={isGroupVisible}
          onGroupVisibility={onGroupVisibility}
        />

        <ObjectCategorySection
          title="Линейные объекты"
          entries={LINE_LAYER_UI_ENTRIES}
          subtypes={lineGroupSubtypes}
          isGroupVisible={isGroupVisible}
          onGroupVisibility={onGroupVisibility}
        />

        <div className="map-layers-poi-block">
          <LayerRow
            label="Точки интереса"
            checked={showPoisOnMap}
            onChange={onShowPoisChange}
            offWhenUnchecked={false}
          />
        </div>
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
            <LayerRow
              key={layer.id}
              label={layer.name}
              checked={layer.is_visible}
              onChange={(visible) => onLayerVisibility(layer.id, visible)}
              disabled={layerVisibilityPending || layerVisibilityReadOnly}
              title={layer.name}
            />
          ))
        )}
      </Section>

      <Section
        id="radii"
        title="Радиусы"
        open={openSections.radii ?? false}
        onToggle={toggleSection}
      >
        <LayerRow label="Все радиусы" checked={showRadii} onChange={onShowRadiiChange} />
        {thresholdMeta.map((m) => (
          <LayerRow
            key={m.subtype}
            label={m.label}
            checked={radiusVisible[m.subtype] ?? true}
            onChange={(visible) => onRadiusVisibleChange(m.subtype, visible)}
            disabled={!showRadii}
            indent="indent"
          >
            <span className="layer-swatch" style={{ background: m.color }} aria-hidden />
            {m.label}
            <span className="map-layers-km">{thresholdKm(m.subtype, m.defaultKm)} км</span>
          </LayerRow>
        ))}
      </Section>
      </div>
    </div>
  );
}
