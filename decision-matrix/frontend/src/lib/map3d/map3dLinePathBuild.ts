import type { InfraObject } from '../api';
import { linePathForDisplay } from '../infraGeometry';
import { lineEndpointAttachmentsFromObject } from '../lineEndpointRules';
import { buildLinePath3dFromProfile, hasLineProfileFor3d } from './map3dLineProfilePath';
import { altitudeForModelPlacement } from './map3dModelsLayer';
import { scaleMap3dMeters } from './map3dConfig';
import { resolveRender3D } from './render3d';

/** Fraction of scaled model height for ЛЭП wire clamp (all other lines use ground). */
export const LINE_ENDPOINT_ATTACH_HEIGHT_FRAC = 0.88;

/** Vertical attach point for a line end at a point object (subtype-specific). */
export function lineEndpointAttachAltitudeM(
  map: import('maplibre-gl').Map,
  lineSubtype: string,
  obj: InfraObject,
): number {
  const render = resolveRender3D(obj.subtype, obj.properties);
  const groundM = altitudeForModelPlacement(map, obj.lon, obj.lat, render.baseM, {
    absoluteBase: render.baseFromDem,
  });
  if (lineSubtype === 'power_line') {
    return groundM + scaleMap3dMeters(render.heightM) * LINE_ENDPOINT_ATTACH_HEIGHT_FRAC;
  }
  return groundM;
}

export type NormalizedLinePath3d = {
  path: [number, number][];
  /** Wire / tube routing (endpoints may use attach height; interior uses plan corridor). */
  alts: number[];
  /** Terrain ground at each vertex — for ЛЭП tower bases (same basis as point 3D models). */
  towerAlts: number[];
};

/** Ground elevation at each path vertex (terrain + baseM), without wire-attach or corridor blend. */
export function towerGroundAltsForPath(
  map: import('maplibre-gl').Map,
  path: [number, number][],
  baseM: number,
): number[] {
  return path.map((p) => altitudeForModelPlacement(map, p[0], p[1], baseM));
}

/** Weak terrain follow along line interior — reduces false “inverted” bend in perspective. */
export const PLAN_CORRIDOR_TERRAIN_BLEND = 0.15;

function applyPlanCorridorAlts(
  map: import('maplibre-gl').Map,
  path: [number, number][],
  alts: number[],
  baseM: number,
): number[] {
  if (path.length < 2) return alts;
  const terrain = path.map((p) => altitudeForModelPlacement(map, p[0], p[1], baseM));
  const meanTerrain = terrain.reduce((s, v) => s + v, 0) / terrain.length;
  const corridorAlt = Math.max(
    alts[0] ?? meanTerrain,
    alts[alts.length - 1] ?? meanTerrain,
    meanTerrain,
  );
  return alts.map((alt, i) => {
    if (i === 0 || i === alts.length - 1) return alt;
    const t = terrain[i] ?? alt;
    return corridorAlt + PLAN_CORRIDOR_TERRAIN_BLEND * (t - corridorAlt);
  });
}

/**
 * Normalized horizontal path (exact object lon/lat at ends) + endpoint altitudes for 3D.
 * Used by tubes and ЛЭП builders for every linear subtype.
 */
export function buildNormalizedLinePath3d(
  map: import('maplibre-gl').Map,
  line: InfraObject,
  infraObjects: InfraObject[],
  baseM: number,
  snapPool?: InfraObject[],
  options?: { planCorridorAlts?: boolean },
): NormalizedLinePath3d | null {
  const pool = snapPool ?? infraObjects;
  const render = resolveRender3D(line.subtype, line.properties);
  const attachments = lineEndpointAttachmentsFromObject(line, pool, pool);

  if (hasLineProfileFor3d(line)) {
    const profileBuilt = buildLinePath3dFromProfile(line, render, { map, attachments });
    if (profileBuilt) return profileBuilt;
  }

  const path = linePathForDisplay(line, pool);
  if (!path) return null;

  let alts = path.map((p) => altitudeForModelPlacement(map, p[0], p[1], baseM));

  if (attachments?.startAttach) {
    alts[0] = lineEndpointAttachAltitudeM(map, line.subtype, attachments.startAttach.object);
  }
  if (attachments?.finishAttach) {
    alts[alts.length - 1] = lineEndpointAttachAltitudeM(
      map,
      line.subtype,
      attachments.finishAttach.object,
    );
  }

  if (options?.planCorridorAlts !== false) {
    alts = applyPlanCorridorAlts(map, path, alts, baseM);
  }

  const towerAlts = towerGroundAltsForPath(map, path, baseM);

  return { path, alts, towerAlts };
}
