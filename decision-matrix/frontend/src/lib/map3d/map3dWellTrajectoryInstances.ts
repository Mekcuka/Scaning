import type { WellTrajectoryGeoJsonFeature } from '../api/wellTrajectoryApi';
import type { InfraObject } from '../api';
import { wellTrajectoryDisplayColor, wellTrajectoryPaletteColor } from '../wellTrajectoryClearance';
import {
  buildMap3dInfraBottomholeInstances,
  filterGeoJsonBottomholesByInfra,
  infraBottomholeDedupeKeys,
} from './map3dInfraBottomholeInstances';
import {
  MAP3D_WELL_BOTTOMHOLE_RADIUS_M,
  MAP3D_WELL_PLAN_LINE_RADIUS_M,
  MAP3D_WELL_TRAJECTORY_RADIUS_M,
} from './map3dConfig';

export type Map3dWellTrajectoryInstance = {
  id: string;
  path: [number, number][];
  alts: number[];
  radiusM: number;
  colorHex: string;
  opacity: number;
  wellIndex: number;
  padId?: string;
};

export type Map3dWellBottomholeInstance = {
  id: string;
  lon: number;
  lat: number;
  altM: number;
  radiusM: number;
  colorHex: string;
  wellIndex: number;
  padId?: string;
};

export type Map3dWellTrajectoryLayerData = {
  trajectories: Map3dWellTrajectoryInstance[];
  bottomholes: Map3dWellBottomholeInstance[];
  planLines: Map3dWellTrajectoryInstance[];
};

function wellFeatureKey(f: WellTrajectoryGeoJsonFeature): string {
  return `${f.properties.infra_object_id ?? 'pad'}:${f.properties.well_index ?? 0}`;
}

/** Parse GeoJSON Point `[lon, lat, z?]`. */
export function parsePoint3d(
  coordinates: unknown,
): { lon: number; lat: number; alt: number } | null {
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
  const lon = Number(coordinates[0]);
  const lat = Number(coordinates[1]);
  const alt = coordinates.length >= 3 ? Number(coordinates[2]) : 0;
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  return { lon, lat, alt: Number.isFinite(alt) ? alt : 0 };
}

/** Parse GeoJSON LineString coordinates `[lon, lat, z?][]` into path + absolute alts. */
export function parseTrajectoryPath3d(
  coordinates: unknown,
): { path: [number, number][]; alts: number[] } | null {
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
  const path: [number, number][] = [];
  const alts: number[] = [];
  for (const c of coordinates) {
    if (!Array.isArray(c) || c.length < 2) continue;
    const lon = Number(c[0]);
    const lat = Number(c[1]);
    const alt = c.length >= 3 ? Number(c[2]) : 0;
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    path.push([lon, lat]);
    alts.push(Number.isFinite(alt) ? alt : 0);
  }
  if (path.length < 2) return null;
  return { path, alts };
}

export function buildMap3dWellTrajectoryInstances(
  features: WellTrajectoryGeoJsonFeature[],
): Map3dWellTrajectoryInstance[] {
  const out: Map3dWellTrajectoryInstance[] = [];
  for (const f of features) {
    if (f.properties.kind !== 'trajectory') continue;
    const parsed = parseTrajectoryPath3d(f.geometry.coordinates);
    if (!parsed) continue;
    const wellIndex = f.properties.well_index ?? 0;
    const threshold = f.properties.sf_warning_threshold ?? 1;
    const colorHex = wellTrajectoryDisplayColor(wellIndex, f.properties.min_sf, threshold);
    out.push({
      id: `${f.properties.infra_object_id ?? 'pad'}:${wellIndex}`,
      path: parsed.path,
      alts: parsed.alts,
      radiusM: MAP3D_WELL_TRAJECTORY_RADIUS_M,
      colorHex,
      opacity: 0.88,
      wellIndex,
      padId: f.properties.infra_object_id,
    });
  }
  return out;
}

export function buildMap3dWellBottomholeInstances(
  features: WellTrajectoryGeoJsonFeature[],
): Map3dWellBottomholeInstance[] {
  const out: Map3dWellBottomholeInstance[] = [];
  for (const f of features) {
    if (f.properties.kind !== 'bottomhole_target_3d') continue;
    const point = parsePoint3d(f.geometry.coordinates);
    if (!point) continue;
    const wellIndex = f.properties.well_index ?? 0;
    out.push({
      id: `bh:${f.properties.infra_object_id ?? 'pad'}:${wellIndex}`,
      lon: point.lon,
      lat: point.lat,
      altM: point.alt,
      radiusM: MAP3D_WELL_BOTTOMHOLE_RADIUS_M,
      colorHex: wellTrajectoryPaletteColor(wellIndex),
      wellIndex,
      padId: f.properties.infra_object_id,
    });
  }
  return out;
}

/** Dashed plan guides ustyie→TD with absolute Z on both ends. */
export function buildMap3dWellPlanLineInstances(
  features: WellTrajectoryGeoJsonFeature[],
): Map3dWellTrajectoryInstance[] {
  const trajHeadAlt = new Map<string, number>();
  const bottomholeAlt = new Map<string, number>();

  for (const f of features) {
    const key = wellFeatureKey(f);
    if (f.properties.kind === 'trajectory') {
      const coords = f.geometry.coordinates as number[][];
      const head = coords[0];
      if (head && head.length >= 3 && Number.isFinite(Number(head[2]))) {
        trajHeadAlt.set(key, Number(head[2]));
      }
    }
    if (f.properties.kind === 'bottomhole_target_3d') {
      const point = parsePoint3d(f.geometry.coordinates);
      if (point) bottomholeAlt.set(key, point.alt);
    }
  }

  const out: Map3dWellTrajectoryInstance[] = [];
  for (const f of features) {
    if (f.properties.kind !== 'bottomhole_plan_line') continue;
    const coords = f.geometry.coordinates as number[][];
    if (!Array.isArray(coords) || coords.length < 2) continue;
    const wh = coords[0];
    const bh = coords[1];
    if (!wh || !bh || wh.length < 2 || bh.length < 2) continue;
    const whLon = Number(wh[0]);
    const whLat = Number(wh[1]);
    const bhLon = Number(bh[0]);
    const bhLat = Number(bh[1]);
    if (![whLon, whLat, bhLon, bhLat].every(Number.isFinite)) continue;

    const key = wellFeatureKey(f);
    const wellIndex = f.properties.well_index ?? 0;
    const whAlt = trajHeadAlt.get(key) ?? (wh.length >= 3 ? Number(wh[2]) : 0);
    const bhAlt = bottomholeAlt.get(key) ?? (bh.length >= 3 ? Number(bh[2]) : whAlt);

    out.push({
      id: `plan:${f.properties.infra_object_id ?? 'pad'}:${wellIndex}`,
      path: [
        [whLon, whLat],
        [bhLon, bhLat],
      ],
      alts: [
        Number.isFinite(whAlt) ? whAlt : 0,
        Number.isFinite(bhAlt) ? bhAlt : 0,
      ],
      radiusM: MAP3D_WELL_PLAN_LINE_RADIUS_M,
      colorHex: '#1565c0',
      opacity: 0.55,
      wellIndex,
      padId: f.properties.infra_object_id,
    });
  }
  return out;
}

export function buildMap3dWellTrajectoryLayerData(
  features: WellTrajectoryGeoJsonFeature[],
  options: {
    includeTrajectories?: boolean;
    includeBottomholes?: boolean;
    includePlanLines?: boolean;
    infraObjects?: InfraObject[];
    infraPool?: InfraObject[];
    includeInfraBottomholes?: boolean;
  } = {},
): Map3dWellTrajectoryLayerData {
  const includeTrajectories = options.includeTrajectories !== false;
  const includeBottomholes = options.includeBottomholes !== false;
  const includePlanLines = options.includePlanLines !== false;
  const includeInfraBottomholes = options.includeInfraBottomholes !== false;

  const infraObjects = options.infraObjects ?? [];
  const infraPool = options.infraPool ?? infraObjects;
  const dedupeKeys =
    includeInfraBottomholes && includeBottomholes
      ? infraBottomholeDedupeKeys(infraObjects)
      : new Set<string>();

  const filteredFeatures =
    dedupeKeys.size > 0 ? filterGeoJsonBottomholesByInfra(features, dedupeKeys) : features;

  const geoBottomholes = includeBottomholes
    ? buildMap3dWellBottomholeInstances(filteredFeatures)
    : [];

  const geoPlanLines = includePlanLines ? buildMap3dWellPlanLineInstances(features) : [];

  let infraBottomholes: Map3dWellBottomholeInstance[] = [];
  let infraGsLines: Map3dWellTrajectoryInstance[] = [];
  if (includeInfraBottomholes && includeBottomholes) {
    const infra = buildMap3dInfraBottomholeInstances(infraObjects, infraPool);
    infraBottomholes = infra.bottomholes;
    infraGsLines = infra.gsLines;
  }

  return {
    trajectories: includeTrajectories ? buildMap3dWellTrajectoryInstances(features) : [],
    bottomholes: [...geoBottomholes, ...infraBottomholes],
    planLines: [...geoPlanLines, ...infraGsLines],
  };
}
