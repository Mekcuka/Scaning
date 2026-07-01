import type { InfraObject } from '../api';
import type { LineProfilePoint } from '../api/lineElevationProfileApi';
import { parseLineProfileFromObject } from '../lineElevationProfile';
import type { LineEndpointAttachment } from '../lineEndpointRules';
import { scaleMap3dMeters } from './map3dConfig';
import {
  LINE_ENDPOINT_ATTACH_HEIGHT_FRAC,
  lineEndpointAttachAltitudeM,
  type NormalizedLinePath3d,
} from './map3dLinePathBuild';
import type { Render3DConfig } from './render3d';

function validProfilePoints(points: LineProfilePoint[]): LineProfilePoint[] {
  return points.filter(
    (p) =>
      Number.isFinite(p.lon) &&
      Number.isFinite(p.lat) &&
      p.elevation_m != null &&
      Number.isFinite(p.elevation_m),
  );
}

/** True when line has ≥2 profile samples with finite elevation for 3D routing. */
export function hasLineProfileFor3d(line: InfraObject): boolean {
  const profile = parseLineProfileFromObject(line);
  if (!profile) return false;
  return validProfilePoints(profile.points).length >= 2;
}

/**
 * Build 3D path from line elevation profile (ЦМР) sample points.
 * Horizontal and vertical follow the computed profile table/chart.
 */
export function buildLinePath3dFromProfile(
  line: InfraObject,
  render: Render3DConfig,
  options: {
    map: import('maplibre-gl').Map;
    attachments?: {
      startAttach: LineEndpointAttachment | null;
      finishAttach: LineEndpointAttachment | null;
    } | null;
  },
): NormalizedLinePath3d | null {
  const profile = parseLineProfileFromObject(line);
  if (!profile) return null;

  const points = validProfilePoints(profile.points);
  if (points.length < 2) return null;

  const path: [number, number][] = points.map((p) => [p.lon, p.lat]);
  const baseM = render.baseM;
  const isPowerLine = line.subtype === 'power_line';
  const wireLiftM = isPowerLine
    ? scaleMap3dMeters(render.heightM) * LINE_ENDPOINT_ATTACH_HEIGHT_FRAC
    : 0;

  const towerAlts = points.map((p) => p.elevation_m! + baseM);
  const alts = points.map((p) => p.elevation_m! + baseM + wireLiftM);

  const { attachments, map } = options;
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

  return { path, alts, towerAlts };
}
