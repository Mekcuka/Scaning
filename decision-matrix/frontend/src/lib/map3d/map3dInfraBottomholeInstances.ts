import type { InfraObject } from '../api';
import {
  readGsLineBottomholeElevations,
  readPointBottomholeElevation,
} from '../wellBottomholeElevation';
import { wellTrajectoryPaletteColor } from '../wellTrajectoryClearance';
import {
  isBottomholeSubtype,
  isGsBottomholeLine,
  isLateralBottomhole,
  readBottomholeLinkedPadId,
  readGsLineEndpoints,
  WELL_BOTTOMHOLE_WELL_INDEX,
} from '../wellBottomholeProperties';
import { MAP3D_WELL_BOTTOMHOLE_RADIUS_M, MAP3D_WELL_PLAN_LINE_RADIUS_M } from './map3dConfig';
import type {
  Map3dWellBottomholeInstance,
  Map3dWellTrajectoryInstance,
} from './map3dWellTrajectoryInstances';

const BOTTOMHOLE_SUBTYPE_COLORS: Record<string, string> = {
  well_bottomhole_nnb: '#1565c0',
  well_bottomhole_gs: '#2e7d32',
  well_bottomhole_gs_heel: '#2e7d32',
  well_bottomhole_gs_toe: '#c62828',
  well_bottomhole_lateral: '#7b1fa2',
};

function readWellIndex(props: Record<string, unknown> | undefined, fallback: number): number {
  const raw = props?.[WELL_BOTTOMHOLE_WELL_INDEX];
  if (raw == null || raw === '') return fallback;
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : fallback;
}

function resolveLinkedPad(obj: InfraObject, infraPool: InfraObject[]): InfraObject | null {
  const padId = readBottomholeLinkedPadId(obj.properties);
  if (!padId) return null;
  return infraPool.find((o) => o.id === padId) ?? null;
}

function bottomholeColor(obj: InfraObject, fallbackIndex: number): string {
  if (isLateralBottomhole(obj)) return BOTTOMHOLE_SUBTYPE_COLORS.well_bottomhole_lateral!;
  const idx = readWellIndex(obj.properties, -1);
  if (idx >= 0) return wellTrajectoryPaletteColor(idx);
  return BOTTOMHOLE_SUBTYPE_COLORS[obj.subtype] ?? wellTrajectoryPaletteColor(fallbackIndex);
}

function sphereInstance(
  id: string,
  lon: number,
  lat: number,
  altM: number,
  colorHex: string,
  wellIndex: number,
  padId?: string,
): Map3dWellBottomholeInstance {
  return {
    id,
    lon,
    lat,
    altM,
    radiusM: MAP3D_WELL_BOTTOMHOLE_RADIUS_M,
    colorHex,
    wellIndex,
    padId,
  };
}

function gsConnectorLine(
  id: string,
  heelLon: number,
  heelLat: number,
  heelAlt: number,
  toeLon: number,
  toeLat: number,
  toeAlt: number,
  colorHex: string,
  wellIndex: number,
  padId?: string,
): Map3dWellTrajectoryInstance {
  return {
    id,
    path: [
      [heelLon, heelLat],
      [toeLon, toeLat],
    ],
    alts: [heelAlt, toeAlt],
    radiusM: MAP3D_WELL_PLAN_LINE_RADIUS_M,
    colorHex,
    opacity: 0.65,
    wellIndex,
    padId,
  };
}

export type Map3dInfraBottomholeBuild = {
  bottomholes: Map3dWellBottomholeInstance[];
  gsLines: Map3dWellTrajectoryInstance[];
};

/** Infra `well_bottomhole_*` at KB − TVD (absolute Z), same frame as trajectory GeoJSON. */
export function buildMap3dInfraBottomholeInstances(
  infraObjects: InfraObject[],
  infraPool: InfraObject[],
): Map3dInfraBottomholeBuild {
  const bottomholes: Map3dWellBottomholeInstance[] = [];
  const gsLines: Map3dWellTrajectoryInstance[] = [];
  let fallbackIndex = 0;

  for (const obj of infraObjects) {
    if (!isBottomholeSubtype(obj.subtype)) continue;
    const pad = resolveLinkedPad(obj, infraPool);
    const padId = pad?.id ?? readBottomholeLinkedPadId(obj.properties) ?? undefined;
    const wellIndex = readWellIndex(obj.properties, fallbackIndex);
    const colorHex = bottomholeColor(obj, fallbackIndex);
    fallbackIndex += 1;

    if (isGsBottomholeLine(obj)) {
      const endpoints = readGsLineEndpoints(obj);
      if (!endpoints) continue;
      const { heelZ, toeZ } = readGsLineBottomholeElevations(obj, pad);
      bottomholes.push(
        sphereInstance(
          `infra-bh:${obj.id}:heel`,
          endpoints.heelLon,
          endpoints.heelLat,
          heelZ,
          BOTTOMHOLE_SUBTYPE_COLORS.well_bottomhole_gs_heel,
          wellIndex,
          padId,
        ),
        sphereInstance(
          `infra-bh:${obj.id}:toe`,
          endpoints.toeLon,
          endpoints.toeLat,
          toeZ,
          BOTTOMHOLE_SUBTYPE_COLORS.well_bottomhole_gs_toe,
          wellIndex,
          padId,
        ),
      );
      gsLines.push(
        gsConnectorLine(
          `infra-gs:${obj.id}`,
          endpoints.heelLon,
          endpoints.heelLat,
          heelZ,
          endpoints.toeLon,
          endpoints.toeLat,
          toeZ,
          colorHex,
          wellIndex,
          padId,
        ),
      );
      continue;
    }

    const altM = readPointBottomholeElevation(obj, pad);
    bottomholes.push(
      sphereInstance(`infra-bh:${obj.id}`, obj.lon, obj.lat, altM, colorHex, wellIndex, padId),
    );
  }

  return { bottomholes, gsLines };
}

/** Keys for deduping GeoJSON TD vs infra objects on the same well. */
export function infraBottomholeDedupeKeys(infraObjects: InfraObject[]): Set<string> {
  const keys = new Set<string>();
  for (const obj of infraObjects) {
    if (!isBottomholeSubtype(obj.subtype)) continue;
    const padId = readBottomholeLinkedPadId(obj.properties) ?? 'pad';
    const wellIndex = readWellIndex(obj.properties, 0);
    keys.add(`${padId}:${wellIndex}`);
  }
  return keys;
}

export function filterGeoJsonBottomholesByInfra<T extends { properties: { infra_object_id?: string; well_index?: number } }>(
  features: T[],
  dedupeKeys: Set<string>,
): T[] {
  if (dedupeKeys.size === 0) return features;
  return features.filter((f) => {
    const padId = f.properties.infra_object_id ?? 'pad';
    const wellIndex = f.properties.well_index ?? 0;
    return !dedupeKeys.has(`${padId}:${wellIndex}`);
  });
}
