import type { InfraObject } from '../api';
import type { LineEndpointAttachment } from '../lineEndpointRules';
import { lineEndpointAttachmentsFromObject } from '../lineEndpointRules';
import {
  LINE_ENDPOINT_ATTACH_HEIGHT_FRAC,
  lineEndpointAttachAltitudeM,
} from './map3dLinePathBuild';

/** @deprecated Use LINE_ENDPOINT_ATTACH_HEIGHT_FRAC */
export const POWER_LINE_WIRE_ATTACH_HEIGHT_FRAC = LINE_ENDPOINT_ATTACH_HEIGHT_FRAC;

export function wireAttachAltitudeM(
  map: import('maplibre-gl').Map,
  obj: InfraObject,
): number {
  return lineEndpointAttachAltitudeM(map, 'power_line', obj);
}

export type PowerLineWireEndpoint = {
  lon: number;
  lat: number;
  /** meters above sea level (terrain + base + optional vertical center) */
  altM: number;
};

/** Towers only on interior vertices (not first / last). */
export function powerLineVertexHasTower(vertexIndex: number, vertexCount: number): boolean {
  return vertexCount > 2 && vertexIndex > 0 && vertexIndex < vertexCount - 1;
}

export function resolvePowerLineWireEndpoint(
  map: import('maplibre-gl').Map,
  pathPoint: [number, number],
  pathAltM: number,
  attach: LineEndpointAttachment | null,
): PowerLineWireEndpoint {
  if (!attach) {
    return { lon: pathPoint[0], lat: pathPoint[1], altM: pathAltM };
  }
  const obj = attach.object;
  return { lon: obj.lon, lat: obj.lat, altM: wireAttachAltitudeM(map, obj) };
}

export function resolvePowerLineEndpoints(
  map: import('maplibre-gl').Map,
  line: InfraObject,
  infraObjects: InfraObject[],
  path: [number, number][],
  alts: number[],
  snapPool?: InfraObject[],
): { startWire: PowerLineWireEndpoint; finishWire: PowerLineWireEndpoint } {
  const pool = snapPool ?? infraObjects;
  const attachments = lineEndpointAttachmentsFromObject(line, infraObjects, pool);
  const start = path[0]!;
  const finish = path[path.length - 1]!;
  return {
    startWire: resolvePowerLineWireEndpoint(
      map,
      start,
      alts[0] ?? 0,
      attachments?.startAttach ?? null,
    ),
    finishWire: resolvePowerLineWireEndpoint(
      map,
      finish,
      alts[alts.length - 1] ?? 0,
      attachments?.finishAttach ?? null,
    ),
  };
}
