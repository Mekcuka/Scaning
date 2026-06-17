import type { InfraObject } from '../api';
import type { PyWellGeoPlotSegment, PyWellGeoTreeNode } from '../api/pywellgeoApi';
import type { WellTrajectory, WellTrajectoryStation } from '../api/wellTrajectoryApi';
import {
  flattenTree,
  isMainBoreContinuation,
  isOnLateralBranch,
  type TreeNodePath,
  wellLabel,
} from '../padClusteringPyWellGeoSettings';
import { lonLatToLocalEnu } from '../padClusteringScene3d';
import {
  GS_HEEL_LABEL,
  GS_TOE_LABEL,
  WELL_BOTTOMHOLE_GS_HEEL_ID,
  isGsBottomholeLine,
  isLateralBottomhole,
  readBottomholeParentId,
  readBottomholeWellIndexForObject,
  readGsHeelTvdM,
  readGsLineEndpoints,
  readGsToeTvdM,
} from '../wellBottomholeProperties';

export type TrajectoryProfilePoint = {
  md: number;
  tvd: number;
  inc?: number;
  azi?: number;
  n?: number;
  e?: number;
  /** Dogleg severity, °/30 m (interval ending at this station). */
  dls?: number;
};

/** Normalization interval for DLS — matches welleng (°/30 m). */
export const DLS_NORMALIZED_INTERVAL_M = 30;

export type ProfileSubjectKind = 'main' | 'lateral';

export type ProfileSubject = {
  id: string;
  kind: ProfileSubjectKind;
  label: string;
  wellIndex: number;
  bottomholeId?: string;
};

export type ProfileChartMarker = {
  label: string;
  md: number;
  tvd: number;
  role: 'heel' | 'toe';
};

type ProfileTarget3d = { n: number; e: number; tvd: number };

function profileHasHorizontalCoords(points: TrajectoryProfilePoint[]): boolean {
  return points.some((p) => p.n != null && p.e != null && Number.isFinite(p.n) && Number.isFinite(p.e));
}

function closestPointOnSegment(
  a: TrajectoryProfilePoint,
  b: TrajectoryProfilePoint,
  target: ProfileTarget3d,
): { md: number; tvd: number; dist: number; n: number; e: number } {
  const ax = a.n ?? 0;
  const ay = a.e ?? 0;
  const az = a.tvd;
  const bx = b.n ?? 0;
  const by = b.e ?? 0;
  const bz = b.tvd;
  const dx = bx - ax;
  const dy = by - ay;
  const dz = bz - az;
  const len2 = dx * dx + dy * dy + dz * dz;
  let t =
    len2 > 0
      ? ((target.n - ax) * dx + (target.e - ay) * dy + (target.tvd - az) * dz) / len2
      : 0;
  t = Math.max(0, Math.min(1, t));
  const pn = ax + t * dx;
  const pe = ay + t * dy;
  const pz = az + t * dz;
  return {
    md: a.md + t * (b.md - a.md),
    tvd: a.tvd + t * (b.tvd - a.tvd),
    dist: Math.hypot(target.n - pn, target.e - pe, target.tvd - pz),
    n: pn,
    e: pe,
  };
}

function findMdForTvd(
  points: TrajectoryProfilePoint[],
  targetTvd: number,
): { md: number; tvd: number } | null {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const minT = Math.min(a.tvd, b.tvd);
    const maxT = Math.max(a.tvd, b.tvd);
    if (targetTvd < minT - 0.01 || targetTvd > maxT + 0.01) continue;
    const span = b.tvd - a.tvd;
    const t = Math.abs(span) > 1e-6 ? (targetTvd - a.tvd) / span : 0;
    return { md: a.md + t * (b.md - a.md), tvd: targetTvd };
  }
  let best = points[0]!;
  let bestDist = Math.abs(best.tvd - targetTvd);
  for (const pt of points) {
    const dist = Math.abs(pt.tvd - targetTvd);
    if (dist < bestDist) {
      bestDist = dist;
      best = pt;
    }
  }
  return { md: best.md, tvd: best.tvd };
}

/** Map a GS target (plan ENU + TVD) to MD/TVD on the profile polyline. */
export function findProfileMarkerPosition(
  points: TrajectoryProfilePoint[],
  target: ProfileTarget3d,
): { md: number; tvd: number } | null {
  if (points.length < 2) return null;

  if (profileHasHorizontalCoords(points)) {
    let best = closestPointOnSegment(points[0]!, points[1]!, target);
    for (let i = 1; i < points.length; i++) {
      const candidate = closestPointOnSegment(points[i - 1]!, points[i]!, target);
      if (candidate.dist < best.dist) best = candidate;
    }
    return { md: best.md, tvd: best.tvd };
  }

  return findMdForTvd(points, target.tvd);
}

/** GS marker on lateral PyWellGeo profile: T1 = min MD, T3 = max MD in TVD band. */
const LATERAL_GS_MARKER_TVD_TOLERANCE_M = 30;

export function findLateralGsMarkerPosition(
  points: TrajectoryProfilePoint[],
  target: ProfileTarget3d,
  role: 'heel' | 'toe',
): { md: number; tvd: number } | null {
  if (points.length < 2) return null;

  type Candidate = { md: number; tvd: number; planDist: number };
  const candidates: Candidate[] = [];

  for (let i = 1; i < points.length; i++) {
    const seg = closestPointOnSegment(points[i - 1]!, points[i]!, target);
    if (Math.abs(seg.tvd - target.tvd) > LATERAL_GS_MARKER_TVD_TOLERANCE_M) continue;
    candidates.push({
      md: seg.md,
      tvd: seg.tvd,
      planDist: Math.hypot(seg.n - target.n, seg.e - target.e),
    });
  }

  if (candidates.length === 0) {
    return findProfileMarkerPosition(points, target);
  }

  candidates.sort((a, b) => {
    if (role === 'toe') {
      if (Math.abs(b.md - a.md) > 5) return b.md - a.md;
    } else if (Math.abs(a.md - b.md) > 5) {
      return a.md - b.md;
    }
    return a.planDist - b.planDist;
  });

  const best = candidates[0]!;
  return { md: best.md, tvd: best.tvd };
}

function gsEndpointsFromBottomhole(
  bh: InfraObject,
  bottomholes: InfraObject[],
  padLon: number,
  padLat: number,
): Array<{ label: string; role: 'heel' | 'toe'; n: number; e: number; tvd: number }> {
  const props = bh.properties ?? {};

  if (isGsBottomholeLine(bh)) {
    const endpoints = readGsLineEndpoints(bh);
    if (!endpoints) return [];
    const heelLocal = lonLatToLocalEnu(endpoints.heelLon, endpoints.heelLat, padLon, padLat);
    const toeLocal = lonLatToLocalEnu(endpoints.toeLon, endpoints.toeLat, padLon, padLat);
    return [
      {
        label: GS_HEEL_LABEL,
        role: 'heel',
        n: heelLocal.north_m,
        e: heelLocal.east_m,
        tvd: readGsHeelTvdM(props),
      },
      {
        label: GS_TOE_LABEL,
        role: 'toe',
        n: toeLocal.north_m,
        e: toeLocal.east_m,
        tvd: readGsToeTvdM(props),
      },
    ];
  }

  if (bh.subtype === 'well_bottomhole_gs_heel' || bh.subtype === 'well_bottomhole_gs') {
    const heelLocal = lonLatToLocalEnu(bh.lon, bh.lat, padLon, padLat);
    const out: Array<{ label: string; role: 'heel' | 'toe'; n: number; e: number; tvd: number }> =
      [
        {
          label: GS_HEEL_LABEL,
          role: 'heel',
          n: heelLocal.north_m,
          e: heelLocal.east_m,
          tvd: readGsHeelTvdM(props),
        },
      ];
    const toe = bottomholes.find(
      (o) =>
        o.subtype === 'well_bottomhole_gs_toe' &&
        o.properties?.[WELL_BOTTOMHOLE_GS_HEEL_ID] === bh.id,
    );
    if (toe) {
      const toeLocal = lonLatToLocalEnu(toe.lon, toe.lat, padLon, padLat);
      out.push({
        label: GS_TOE_LABEL,
        role: 'toe',
        n: toeLocal.north_m,
        e: toeLocal.east_m,
        tvd: readGsToeTvdM(toe.properties ?? props),
      });
    }
    return out;
  }

  return [];
}

function gsEndpointsForWell(
  bottomholes: InfraObject[],
  wellIndex: number,
  padLon: number,
  padLat: number,
): Array<{ label: string; role: 'heel' | 'toe'; n: number; e: number; tvd: number }> {
  for (const bh of bottomholes) {
    if (isLateralBottomhole(bh)) continue;
    const idx = readBottomholeWellIndexForObject(bh, bottomholes);
    if (idx !== wellIndex) continue;
    const endpoints = gsEndpointsFromBottomhole(bh, bottomholes, padLon, padLat);
    if (endpoints.length > 0) return endpoints;
  }
  return [];
}

/** T1/T3 markers for GS bottomholes on the MD–TVD profile (main bore or lateral). */
export function resolveGsProfileMarkers(
  points: TrajectoryProfilePoint[],
  bottomholes: InfraObject[],
  subject: ProfileSubject,
  padLon: number,
  padLat: number,
): ProfileChartMarker[] {
  let endpoints: Array<{ label: string; role: 'heel' | 'toe'; n: number; e: number; tvd: number }> =
    [];

  if (subject.kind === 'lateral' && subject.bottomholeId) {
    const lateral = bottomholes.find((b) => b.id === subject.bottomholeId);
    if (lateral) {
      endpoints = gsEndpointsFromBottomhole(lateral, bottomholes, padLon, padLat);
    }
  } else {
    endpoints = gsEndpointsForWell(bottomholes, subject.wellIndex, padLon, padLat);
  }

  const markers: ProfileChartMarker[] = [];
  for (const ep of endpoints) {
    const pos =
      subject.kind === 'lateral'
        ? findLateralGsMarkerPosition(points, ep, ep.role)
        : findProfileMarkerPosition(points, ep);
    if (!pos) continue;
    markers.push({ label: ep.label, role: ep.role, md: pos.md, tvd: pos.tvd });
  }
  return markers;
}

function segmentLength3d(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
): number {
  return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
}

/** Dogleg angle (°) between two survey stations with inclination and azimuth in degrees. */
export function doglegAngleDeg(
  inc1Deg: number,
  azi1Deg: number,
  inc2Deg: number,
  azi2Deg: number,
): number {
  const inc1 = (inc1Deg * Math.PI) / 180;
  const inc2 = (inc2Deg * Math.PI) / 180;
  const dAz = ((azi2Deg - azi1Deg) * Math.PI) / 180;
  const cosDl =
    Math.cos(inc2 - inc1) - Math.sin(inc1) * Math.sin(inc2) * (1 - Math.cos(dAz));
  const clamped = Math.max(-1, Math.min(1, cosDl));
  return (Math.acos(clamped) * 180) / Math.PI;
}

function tangentUnit(
  a: TrajectoryProfilePoint,
  b: TrajectoryProfilePoint,
): { e: number; n: number; t: number } | null {
  const dE = (b.e ?? 0) - (a.e ?? 0);
  const dN = (b.n ?? 0) - (a.n ?? 0);
  const dT = b.tvd - a.tvd;
  const len = Math.hypot(dE, dN, dT);
  if (len <= 0) return null;
  return { e: dE / len, n: dN / len, t: dT / len };
}

function angleBetweenUnitVectors(
  u: { e: number; n: number; t: number },
  v: { e: number; n: number; t: number },
): number {
  const dot = u.e * v.e + u.n * v.n + u.t * v.t;
  const clamped = Math.max(-1, Math.min(1, dot));
  return (Math.acos(clamped) * 180) / Math.PI;
}

function readStationNum(raw: unknown): number | undefined {
  if (raw == null || raw === '') return undefined;
  const n = typeof raw === 'number' ? raw : Number(String(raw).replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}

function hasIncAzi(pt: TrajectoryProfilePoint): boolean {
  return (
    pt.inc != null &&
    pt.azi != null &&
    Number.isFinite(pt.inc) &&
    Number.isFinite(pt.azi)
  );
}

/** Inclination / azimuth (°) from displacement along the interval ending at `pt`. */
export function incAziFromInterval(
  prev: TrajectoryProfilePoint,
  pt: TrajectoryProfilePoint,
): { inc: number; azi: number } | null {
  const dMd = pt.md - prev.md;
  const dN = (pt.n ?? 0) - (prev.n ?? 0);
  const dE = (pt.e ?? 0) - (prev.e ?? 0);
  const dTvd = pt.tvd - prev.tvd;
  const cl = Math.hypot(dN, dE, dTvd);
  const span = dMd > 0 ? dMd : cl;
  if (span <= 0) return null;

  const horiz = Math.hypot(dN, dE);
  const inc = (Math.acos(Math.min(1, Math.max(0, Math.abs(dTvd) / span))) * 180) / Math.PI;
  if (horiz <= 1e-9) {
    return { inc, azi: prev.azi ?? 0 };
  }
  let azi = (Math.atan2(dE, dN) * 180) / Math.PI;
  if (azi < 0) azi += 360;
  return { inc, azi };
}

/** Fill missing inc/azi from N/E/TVD (PyWellGeo and sparse survey rows). */
export function enrichIncAziFromCoordinates(
  points: TrajectoryProfilePoint[],
): TrajectoryProfilePoint[] {
  if (points.length === 0) return [];
  return points.map((pt, i) => {
    if (hasIncAzi(pt)) return pt;
    if (i === 0) {
      return {
        ...pt,
        inc: readStationNum(pt.inc) ?? 0,
        azi: readStationNum(pt.azi) ?? 0,
      };
    }
    const prev = points[i - 1]!;
    const derived = incAziFromInterval(prev, pt);
    if (!derived) return pt;
    return {
      ...pt,
      inc: readStationNum(pt.inc) ?? derived.inc,
      azi: readStationNum(pt.azi) ?? derived.azi,
    };
  });
}

export function finalizeProfilePoints(points: TrajectoryProfilePoint[]): TrajectoryProfilePoint[] {
  return annotateProfileWithDls(enrichIncAziFromCoordinates(points));
}

/** Add interval DLS (°/30 m) to each station; first station is 0. */
function annotateProfileWithDls(points: TrajectoryProfilePoint[]): TrajectoryProfilePoint[] {
  if (points.length === 0) return [];
  return points.map((pt, i) => {
    if (i === 0) return { ...pt, dls: 0 };
    const prev = points[i - 1]!;
    const deltaMd = pt.md - prev.md;
    if (deltaMd <= 0) return { ...pt, dls: undefined };

    const incAziReady = hasIncAzi(prev) && hasIncAzi(pt);

    let dogleg: number;
    if (incAziReady) {
      dogleg = doglegAngleDeg(prev.inc!, prev.azi!, pt.inc!, pt.azi!);
    } else {
      const tIn = tangentUnit(prev, pt);
      if (!tIn) return { ...pt, dls: undefined };
      if (i === 1) {
        dogleg = angleBetweenUnitVectors({ e: 0, n: 0, t: 1 }, tIn);
      } else {
        const prevPrev = points[i - 2]!;
        const tPrev = tangentUnit(prevPrev, prev);
        if (!tPrev) return { ...pt, dls: undefined };
        dogleg = angleBetweenUnitVectors(tPrev, tIn);
      }
    }
    return { ...pt, dls: (dogleg * DLS_NORMALIZED_INTERVAL_M) / deltaMd };
  });
}

function stationFromSurvey(st: WellTrajectoryStation, mdFallback: number): TrajectoryProfilePoint | null {
  const md = readStationNum(st.md) ?? mdFallback;
  const tvd = readStationNum(st.tvd);
  if (tvd == null) return null;
  return {
    md,
    tvd,
    inc: readStationNum(st.inc),
    azi: readStationNum(st.azi),
    n: readStationNum(st.n),
    e: readStationNum(st.e),
  };
}

/** Main bore profile from welleng survey stations. */
export function mainTrajectoryProfile(trajectory: WellTrajectory): TrajectoryProfilePoint[] {
  const stations = trajectory.survey?.stations ?? [];
  const out: TrajectoryProfilePoint[] = [];
  let mdFallback = 0;
  for (const st of stations) {
    const pt = stationFromSurvey(st, mdFallback);
    if (!pt) continue;
    mdFallback = pt.md;
    out.push(pt);
  }
  return out;
}

function nodesAlongPath(root: PyWellGeoTreeNode, path: TreeNodePath): PyWellGeoTreeNode[] {
  const chain: PyWellGeoTreeNode[] = [root];
  let node = root;
  for (const idx of path) {
    const child = node.branches[idx];
    if (!child) break;
    chain.push(child);
    node = child;
  }
  return chain;
}

function profileFromNodeChain(nodes: PyWellGeoTreeNode[]): TrajectoryProfilePoint[] {
  if (nodes.length === 0) return [];
  const out: TrajectoryProfilePoint[] = [];
  let md = 0;
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!;
    if (i > 0) {
      md += segmentLength3d(nodes[i - 1]!, node);
    }
    out.push({ md, tvd: -node.z, n: node.y, e: node.x });
  }
  return out;
}

/** Walk main bore (branches[0] while continuation) then a lateral branch chain via branches[0]. */
export function lateralProfileFromTreePath(
  root: PyWellGeoTreeNode,
  lateralEntryPath: TreeNodePath,
): TrajectoryProfilePoint[] {
  const mainChain: PyWellGeoTreeNode[] = [root];
  let node = root;
  for (let depth = 0; depth < lateralEntryPath.length; depth++) {
    const idx = lateralEntryPath[depth]!;
    const child = node.branches[idx];
    if (!child) break;
    if (depth < lateralEntryPath.length - 1) {
      mainChain.push(child);
      node = child;
      continue;
    }
    const lateralChain = [child];
    let lat = child;
    while (lat.branches[0]) {
      lat = lat.branches[0]!;
      lateralChain.push(lat);
    }
    return profileFromNodeChain([...mainChain, ...lateralChain]);
  }
  return profileFromNodeChain(mainChain);
}

/** Cumulative MD along plot segments; TVD = -z. */
export function profileFromPlotSegments(segments: PyWellGeoPlotSegment[]): TrajectoryProfilePoint[] {
  if (segments.length === 0) return [];
  const out: TrajectoryProfilePoint[] = [];
  let md = 0;
  const first = segments[0]!.from_xyz;
  if (first.length >= 3) {
    out.push({ md: 0, tvd: -first[2]!, e: first[0], n: first[1] });
  }
  for (const seg of segments) {
    const to = seg.to_xyz;
    if (to.length < 3) continue;
    const from = seg.from_xyz;
    const len =
      from.length >= 3
        ? Math.hypot(to[0]! - from[0]!, to[1]! - from[1]!, to[2]! - from[2]!)
        : 0;
    md += len;
    out.push({ md, tvd: -to[2]!, e: to[0], n: to[1] });
  }
  return out;
}

export function listMainProfileSubjects(trajectories: WellTrajectory[]): ProfileSubject[] {
  return trajectories
    .filter((t) => (t.survey?.stations?.length ?? 0) >= 2)
    .map((t) => ({
      id: `main:${t.well_index}`,
      kind: 'main' as const,
      label: wellLabel(t.well_index, t.name),
      wellIndex: t.well_index,
    }));
}

export function listLateralProfileSubjects(
  bottomholes: InfraObject[],
  trees: Array<{ well_index: number; tree: PyWellGeoTreeNode; name?: string | null }>,
  _padLon = 0,
  _padLat = 0,
): ProfileSubject[] {
  const treeByWell = new Map(trees.map((t) => [t.well_index, t]));
  const out: ProfileSubject[] = [];
  for (const lateral of bottomholes.filter(isLateralBottomhole)) {
    const parentId = readBottomholeParentId(lateral.properties);
    const parent = parentId ? bottomholes.find((b) => b.id === parentId) : null;
    const wellIndex = parent
      ? readBottomholeWellIndexForObject(parent, bottomholes)
      : readBottomholeWellIndexForObject(lateral, bottomholes);
    if (wellIndex == null) continue;
    const treeRec = treeByWell.get(wellIndex);
    if (!treeRec) continue;
    const flat = flattenTree(treeRec.tree);
    const hasLateralBranch = flat.some(({ path }) => path.length > 0 && isOnLateralBranch(treeRec.tree, path));
    if (!hasLateralBranch) continue;
    out.push({
      id: `lateral:${lateral.id}`,
      kind: 'lateral',
      label: `${lateral.name} (${wellLabel(wellIndex, treeRec.name)})`,
      wellIndex,
      bottomholeId: lateral.id,
    });
  }
  return out;
}

export function resolveProfilePoints(
  subject: ProfileSubject,
  trajectories: WellTrajectory[],
  trees: Array<{ well_index: number; tree: PyWellGeoTreeNode }>,
  bottomholes: InfraObject[],
  plotSegments?: PyWellGeoPlotSegment[],
): TrajectoryProfilePoint[] {
  let points: TrajectoryProfilePoint[];
  if (subject.kind === 'main') {
    const traj = trajectories.find((t) => t.well_index === subject.wellIndex);
    points = traj ? mainTrajectoryProfile(traj) : [];
  } else if (plotSegments?.length) {
    points = profileFromPlotSegments(plotSegments);
  } else {
    const treeRec = trees.find((t) => t.well_index === subject.wellIndex);
    if (!treeRec) return [];
    const lateral = subject.bottomholeId
      ? bottomholes.find((b) => b.id === subject.bottomholeId)
      : null;
    const flat = flattenTree(treeRec.tree);
    const lateralEntries = flat.filter(
      ({ path, node }) =>
        path.length > 0 &&
        node.branches.some(
          (branch, idx) => !isMainBoreContinuation(node, branch, idx),
        ),
    );
    if (lateralEntries.length === 0) return [];
    let entryPath = lateralEntries[0]!.path;
    if (lateral?.lon != null && lateral.lat != null) {
      let bestDist = Infinity;
      for (const { path } of lateralEntries) {
        const nodes = nodesAlongPath(treeRec.tree, path);
        const kickoff = nodes[nodes.length - 1]!;
        const firstLateral = kickoff.branches.find(
          (branch, idx) => !isMainBoreContinuation(kickoff, branch, idx),
        );
        if (!firstLateral) continue;
        const dist = Math.hypot(firstLateral.x, firstLateral.y);
        if (dist < bestDist) {
          bestDist = dist;
          entryPath = path;
        }
      }
    }
    const kickoffNode = nodesAlongPath(treeRec.tree, entryPath);
    const parent = kickoffNode[kickoffNode.length - 1]!;
    const lateralBranchIdx = parent.branches.findIndex(
      (branch, idx) => !isMainBoreContinuation(parent, branch, idx),
    );
    if (lateralBranchIdx < 0) return [];
    points = lateralProfileFromTreePath(treeRec.tree, [...entryPath, lateralBranchIdx]);
  }
  return finalizeProfilePoints(points);
}
