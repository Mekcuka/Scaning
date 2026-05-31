import type { InfraObject } from '../api';
import type { LineEndpointAttachment } from '../lineEndpointRules';
import { lineEndpointAttachmentsFromObject } from '../lineEndpointRules';
import { altitudeForModelPlacement } from './map3dModelsLayer';
import { scaleMap3dMeters } from './map3dConfig';
import { resolveRender3D } from './render3d';

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
  const render = resolveRender3D(obj.subtype, obj.properties);
  const groundM = altitudeForModelPlacement(map, obj.lon, obj.lat, render.baseM);
  const centerLiftM = scaleMap3dMeters(render.heightM) * 0.5;
  return { lon: obj.lon, lat: obj.lat, altM: groundM + centerLiftM };
}

export function resolvePowerLineEndpoints(
  map: import('maplibre-gl').Map,
  line: InfraObject,
  infraObjects: InfraObject[],
  path: [number, number][],
  alts: number[],
): { startWire: PowerLineWireEndpoint; finishWire: PowerLineWireEndpoint } {
  const attachments = lineEndpointAttachmentsFromObject(line, infraObjects);
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
