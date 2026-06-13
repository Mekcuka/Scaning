/** Client-side map layer panel toggles (persisted per project in localStorage). */

import { createDefaultSubtypeFilter } from './api';
import {
  clampLineLodScaleThreshold,
  DEFAULT_LINE_LOD_SCALE_THRESHOLD,
} from './mapLineLod';

export type MapLayerOpenSections = {
  basemap: boolean;
  objects: boolean;
  sources: boolean;
  radii: boolean;
};

export type MapLayerPreferences = {
  showBasemap: boolean;
  showTerrain: boolean;
  showModels: boolean;
  showPoisOnMap: boolean;
  showRadii: boolean;
  radiusVisible: Record<string, boolean>;
  subtypeFilter: Record<string, boolean>;
  openSections: MapLayerOpenSections;
  /** Simplify lines to 2 points when map scale 1:N is at or above this N. */
  lineLodScaleThreshold: number;
  /** Horizontal plan projection of well trajectories (2D map). */
  showWellTrajectories: boolean;
  /** Bottomhole target markers on 2D map. */
  showWellBottomholes: boolean;
  /** 3D trajectory lines (MapLibre). */
  showWellTrajectories3d: boolean;
};

const DEFAULT_RADIUS_VISIBLE: Record<string, boolean> = {
  gas_processing: true,
  gtes: true,
  substation: true,
  refinery: true,
};

const DEFAULT_OPEN_SECTIONS: MapLayerOpenSections = {
  basemap: true,
  objects: false,
  sources: false,
  radii: false,
};

export function defaultMapLayerPreferences(): MapLayerPreferences {
  return {
    showBasemap: true,
    showTerrain: false,
    showModels: true,
    showPoisOnMap: true,
    showRadii: false,
    radiusVisible: { ...DEFAULT_RADIUS_VISIBLE },
    subtypeFilter: createDefaultSubtypeFilter(),
    openSections: { ...DEFAULT_OPEN_SECTIONS },
    lineLodScaleThreshold: DEFAULT_LINE_LOD_SCALE_THRESHOLD,
    showWellTrajectories: true,
    showWellBottomholes: true,
    showWellTrajectories3d: true,
  };
}

function storageKey(projectId: string | null): string {
  return `dm-map-layer-prefs:${projectId ?? '_none'}`;
}

function mergeBoolRecord(
  defaults: Record<string, boolean>,
  saved: unknown,
): Record<string, boolean> {
  if (!saved || typeof saved !== 'object') return { ...defaults };
  const out = { ...defaults };
  for (const [k, v] of Object.entries(saved as Record<string, unknown>)) {
    if (typeof v === 'boolean') out[k] = v;
  }
  return out;
}

function parseOpenSections(raw: unknown): MapLayerOpenSections {
  const def = { ...DEFAULT_OPEN_SECTIONS };
  if (!raw || typeof raw !== 'object') return def;
  const o = raw as Record<string, unknown>;
  return {
    basemap: typeof o.basemap === 'boolean' ? o.basemap : def.basemap,
    objects: typeof o.objects === 'boolean' ? o.objects : def.objects,
    sources: typeof o.sources === 'boolean' ? o.sources : def.sources,
    radii: typeof o.radii === 'boolean' ? o.radii : def.radii,
  };
}

export function loadMapLayerPreferences(projectId: string | null): MapLayerPreferences {
  const defaults = defaultMapLayerPreferences();
  try {
    const raw = localStorage.getItem(storageKey(projectId));
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<MapLayerPreferences>;
    return {
      showBasemap: typeof parsed.showBasemap === 'boolean' ? parsed.showBasemap : defaults.showBasemap,
      showTerrain: false,
      showModels: typeof parsed.showModels === 'boolean' ? parsed.showModels : defaults.showModels,
      showPoisOnMap:
        typeof parsed.showPoisOnMap === 'boolean' ? parsed.showPoisOnMap : defaults.showPoisOnMap,
      showRadii: typeof parsed.showRadii === 'boolean' ? parsed.showRadii : defaults.showRadii,
      radiusVisible: mergeBoolRecord(defaults.radiusVisible, parsed.radiusVisible),
      subtypeFilter: mergeBoolRecord(defaults.subtypeFilter, parsed.subtypeFilter),
      openSections: parseOpenSections(parsed.openSections),
      lineLodScaleThreshold:
        typeof parsed.lineLodScaleThreshold === 'number'
          ? clampLineLodScaleThreshold(parsed.lineLodScaleThreshold)
          : defaults.lineLodScaleThreshold,
      showWellTrajectories:
        typeof parsed.showWellTrajectories === 'boolean'
          ? parsed.showWellTrajectories
          : defaults.showWellTrajectories,
      showWellBottomholes:
        typeof parsed.showWellBottomholes === 'boolean'
          ? parsed.showWellBottomholes
          : defaults.showWellBottomholes,
      showWellTrajectories3d:
        typeof parsed.showWellTrajectories3d === 'boolean'
          ? parsed.showWellTrajectories3d
          : defaults.showWellTrajectories3d,
    };
  } catch {
    return defaults;
  }
}

export function saveMapLayerPreferences(
  projectId: string | null,
  prefs: MapLayerPreferences,
): void {
  try {
    localStorage.setItem(storageKey(projectId), JSON.stringify(prefs));
  } catch {
    /* quota / private mode */
  }
}
