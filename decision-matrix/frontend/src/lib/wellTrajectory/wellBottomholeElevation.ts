import type { InfraObject } from '../api';
import {
  DEFAULT_PAD_HEIGHT_M,
  DEFAULT_PAD_REFERENCE_ELEVATION_M,
  readPadHeightFromProperties,
  readPadReferenceElevationFromProperties,
} from '../infraPadEarthwork';
import { kbFromPad } from '../padClusteringScene3d';
import {
  readBottomholeTvdM,
  readGsHeelTvdM,
  readGsToeTvdM,
} from '../wellBottomholeProperties';

export function readPadKbM(pad: InfraObject | null | undefined): number {
  if (!pad) {
    return kbFromPad(DEFAULT_PAD_REFERENCE_ELEVATION_M, DEFAULT_PAD_HEIGHT_M);
  }
  const ref = Number(readPadReferenceElevationFromProperties(pad.properties));
  const height = Number(readPadHeightFromProperties(pad.properties));
  return kbFromPad(
    Number.isFinite(ref) ? ref : DEFAULT_PAD_REFERENCE_ELEVATION_M,
    Number.isFinite(height) ? height : DEFAULT_PAD_HEIGHT_M,
  );
}

export function elevationFromTvd(kbM: number, tvdM: number): number {
  return kbM - tvdM;
}

export function tvdFromElevation(kbM: number, elevationM: number): number {
  return kbM - elevationM;
}

export function formatBottomholeElevation(elevationM: number): string {
  return elevationM.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
}

export function readPointBottomholeElevation(
  obj: InfraObject,
  pad: InfraObject | null | undefined,
): number {
  const kbM = readPadKbM(pad);
  return elevationFromTvd(kbM, readBottomholeTvdM(obj.properties));
}

export function readGsLineBottomholeElevations(
  obj: InfraObject,
  pad: InfraObject | null | undefined,
): { heelZ: number; toeZ: number } {
  const kbM = readPadKbM(pad);
  const props = obj.properties;
  return {
    heelZ: elevationFromTvd(kbM, readGsHeelTvdM(props)),
    toeZ: elevationFromTvd(kbM, readGsToeTvdM(props)),
  };
}

export function bottomholeShowsEndPoint(subtype: string): boolean {
  return subtype === 'well_bottomhole_gs';
}

/** 3D distance heel→toe: plan length plus vertical delta from Z (or TVD-derived elevation). */
export function gsBottomhole3dLengthMeters(
  planLengthM: number,
  heelZ: number,
  toeZ: number,
): number {
  if (!Number.isFinite(planLengthM) || planLengthM <= 0) return 0;
  const dz = heelZ - toeZ;
  return Math.sqrt(planLengthM * planLengthM + dz * dz);
}

export type BottomholeCopySources = {
  lon: number;
  lat: number;
  endLon?: number | null;
  endLat?: number | null;
  z?: number;
  zHeel?: number;
  zToe?: number;
};

export function readBottomholeCopySources(
  obj: InfraObject,
  pad: InfraObject | null | undefined,
  propsPatch: Record<string, unknown> = {},
): BottomholeCopySources {
  const merged = { ...obj, properties: { ...(obj.properties ?? {}), ...propsPatch } };
  const sources: BottomholeCopySources = {
    lon: obj.lon,
    lat: obj.lat,
    endLon: obj.end_lon,
    endLat: obj.end_lat,
  };
  if (obj.subtype === 'well_bottomhole_gs') {
    const { heelZ, toeZ } = readGsLineBottomholeElevations(merged, pad);
    sources.zHeel = heelZ;
    sources.zToe = toeZ;
  } else {
    sources.z = readPointBottomholeElevation(merged, pad);
  }
  return sources;
}
