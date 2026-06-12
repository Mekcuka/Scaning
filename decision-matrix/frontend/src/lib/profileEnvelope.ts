import {
  profileLengthM,
  sortChainagePoints,
  estimateProfileVolumes,
  envelopeBermCrossSectionAreaM2,
  envelopeBermSlopeHeightM,
  type ProfileSketch,
} from './padEarthworkSketch';

export type ProfileEnvelopeParams = {
  minChainage: number;
  maxChainage: number;
  designElevationM: number;
  referenceElevationM: number;
  wrapWidthM: number;
};

export function profileChainageBounds(
  points: { chainage_m: number; elevation_m: number }[],
): { minChainage: number; maxChainage: number } {
  if (points.length === 0) return { minChainage: 0, maxChainage: 0 };
  const chainages = points.map((p) => p.chainage_m);
  return { minChainage: Math.min(...chainages), maxChainage: Math.max(...chainages) };
}

export function envelopeBermCrestElevationM(params: ProfileEnvelopeParams): number {
  return params.designElevationM + envelopeBermSlopeHeightM(params.wrapWidthM);
}

export function envelopeSurfaceElevation(
  chainageM: number,
  params: ProfileEnvelopeParams,
): number {
  const { minChainage, maxChainage, designElevationM, referenceElevationM } = params;
  if (chainageM >= minChainage && chainageM <= maxChainage) {
    return designElevationM;
  }
  return referenceElevationM;
}

export function terrainElevationAtChainage(
  chainageM: number,
  points: { chainage_m: number; elevation_m: number }[],
): number | null {
  const sorted = sortChainagePoints(points);
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0].elevation_m;
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (chainageM <= first.chainage_m) return first.elevation_m;
  if (chainageM >= last.chainage_m) return last.elevation_m;
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const p0 = sorted[i];
    const p1 = sorted[i + 1];
    if (chainageM >= p0.chainage_m && chainageM <= p1.chainage_m) {
      const ds = p1.chainage_m - p0.chainage_m;
      if (ds <= 0) return p0.elevation_m;
      const t = (chainageM - p0.chainage_m) / ds;
      return p0.elevation_m + t * (p1.elevation_m - p0.elevation_m);
    }
  }
  return last.elevation_m;
}

export function buildProfileEnvelopePolyline(params: ProfileEnvelopeParams): string {
  const { minChainage, maxChainage, designElevationM, wrapWidthM } = params;
  if (wrapWidthM <= 0) {
    return `${minChainage},${designElevationM} ${maxChainage},${designElevationM}`;
  }
  const crestM = envelopeBermCrestElevationM(params);
  const slopeH = envelopeBermSlopeHeightM(wrapWidthM);
  const leftCrestS = minChainage + slopeH;
  const rightCrestS = maxChainage - slopeH;
  return [
    `${minChainage},${designElevationM}`,
    `${leftCrestS},${crestM}`,
    `${rightCrestS},${crestM}`,
    `${maxChainage},${designElevationM}`,
  ].join(' ');
}

/** Berm fence on pad top: sole at design, crest at design + H. */
export function buildProfileEnvelopeBodyPolygon(params: ProfileEnvelopeParams): string {
  return buildProfileEnvelopePolyline(params);
}

export function profileEnvelopeExtraVolumeM3(
  lengthM: number,
  widthM: number,
  _heightM: number,
  wrapWidthM: number,
): number {
  if (wrapWidthM <= 0 || lengthM <= 0 || widthM <= 0) return 0;
  const cross = envelopeBermCrossSectionAreaM2(wrapWidthM);
  return 2 * (lengthM + widthM) * cross;
}

export function estimateProfileEnvelopeVolumes(
  sketch: ProfileSketch,
  heightM: number,
  wrapWidthM: number,
): { fill_m3: number; cut_m3: number } {
  const strip = estimateProfileVolumes(sketch);
  const lengthM = profileLengthM(sortChainagePoints(sketch.chainage_points));
  const extra = profileEnvelopeExtraVolumeM3(lengthM, sketch.width_m, heightM, wrapWidthM);
  return { fill_m3: strip.fill_m3 + extra, cut_m3: strip.cut_m3 };
}

export function buildEnvelopeFillCutSegments(
  sketch: ProfileSketch,
  envelopeParams: ProfileEnvelopeParams,
  sampleStep = 1,
): { fill: string; cut: string }[] {
  const points = sortChainagePoints(sketch.chainage_points);
  if (points.length < 2) return [];

  const { minChainage, maxChainage, wrapWidthM } = envelopeParams;
  const polys: { fill: string; cut: string }[] = [];

  for (let s = minChainage; s < maxChainage - 1e-9; s += sampleStep) {
    const s1 = Math.min(s + sampleStep, maxChainage);
    if (s1 <= s) continue;
    const z0 = terrainElevationAtChainage(s, points);
    const z1 = terrainElevationAtChainage(s1, points);
    if (z0 == null || z1 == null) continue;
    const surf0 = envelopeSurfaceElevation(s, envelopeParams);
    const surf1 = envelopeSurfaceElevation(s1, envelopeParams);
    const avgFill = (Math.max(surf0 - z0, 0) + Math.max(surf1 - z1, 0)) / 2;
    const avgCut = (Math.max(z0 - surf0, 0) + Math.max(z1 - surf1, 0)) / 2;
    if (avgFill > 0.01) {
      polys.push({
        fill: `${s},${surf0} ${s1},${surf1} ${s1},${z1} ${s},${z0}`,
        cut: '',
      });
    }
    if (avgCut > 0.01) {
      polys.push({
        fill: '',
        cut: `${s},${surf0} ${s1},${surf1} ${s1},${z1} ${s},${z0}`,
      });
    }
  }
  return polys;
}
