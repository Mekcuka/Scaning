/** 3D helpers for pad clustering page: wellheads, trajectories, bottomhole targets. */

import * as THREE from 'three';
import type { InfraObject } from './api';
import type { PyWellGeoPlotSegment } from './api/pywellgeoApi';
import type { WellTrajectory } from './api/wellTrajectoryApi';
import { metersPerDegree } from './padFootprintGeo';
import type { PlanVertex } from './padEarthworkSketch';
import { planEastToSceneX, planNorthToSceneZ } from './padEarthworkScene3d';
import {
  buildGsBottomholeConnectors,
  buildLateralBottomholeConnectors,
  isLateralBottomhole,
  lateralBottomholeIdsWithBranchCoverage,
  readBottomholeTvdM,
  readGsHeelTvdM,
  readGsLineEndpoints,
  readGsToeTvdM,
  type LateralBranchPlanEndpoint,
  WELL_BOTTOMHOLE_WELL_INDEX,
  GS_HEEL_LABEL,
  GS_TOE_LABEL,
} from './wellBottomholeProperties';
import {
  wellTrajectoryDisplayColorHex,
  wellTrajectoryPaletteColorHex,
} from './wellTrajectoryClearance';
import { clusteringWellLabel } from './padClusteringScene3dLayers';

export type ScenePoint = { x: number; y: number; z: number };

/** Plan ENU → scene: X=−east, Y=KB−TVD, Z=north (aligned with 2D sketch in top view). */
export function stationToScenePoint(
  eastM: number,
  northM: number,
  tvdM: number,
  kbM: number,
): ScenePoint {
  return { x: planEastToSceneX(eastM), y: kbM - tvdM, z: planNorthToSceneZ(northM) };
}

export function kbFromPad(referenceElevationM: number, heightM: number): number {
  return referenceElevationM + heightM;
}

const WELL_TRAJECTORY_MATCH_TOL_M = 0.75;

/** Whether survey head stations match persisted local wellhead layout (same ENU frame). */
export function trajectoriesAlignWithWells(
  trajectories: WellTrajectory[],
  wellsLocal: PlanVertex[],
): boolean {
  if (trajectories.length === 0) return true;
  if (wellsLocal.length === 0) return false;
  if (trajectories.length !== wellsLocal.length) return false;

  for (const traj of trajectories) {
    const idx = traj.well_index ?? trajectories.indexOf(traj);
    if (idx < 0 || idx >= wellsLocal.length) return false;
    const well = wellsLocal[idx];
    if (!well) return false;
    const stations = traj.survey?.stations ?? [];
    const head = stations[0];
    if (!head) return false;
    const e = Number(head.e ?? head.east_m);
    const n = Number(head.n ?? head.north_m);
    if (!Number.isFinite(e) || !Number.isFinite(n)) return false;
    if (
      Math.abs(e - well.east_m) > WELL_TRAJECTORY_MATCH_TOL_M ||
      Math.abs(n - well.north_m) > WELL_TRAJECTORY_MATCH_TOL_M
    ) {
      return false;
    }
  }
  return true;
}

export type BuildWellheadMarkersOptions = {
  selectedWellIndex?: number | null;
};

export const WELLHEAD_PICK_ROLE = 'wellhead';

const PICK_DRAG_THRESHOLD_PX = 4;

export function pickWellheadIndex(
  event: PointerEvent,
  canvas: HTMLCanvasElement,
  camera: THREE.Camera,
  wellheadsLayer: THREE.Object3D | null | undefined,
): number | null {
  if (!wellheadsLayer?.visible) return null;
  const rect = canvas.getBoundingClientRect();
  const ndcX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const ndcY = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
  const hits = raycaster.intersectObject(wellheadsLayer, true);
  for (const hit of hits) {
    const data = hit.object.userData as { pickRole?: string; wellIndex?: number };
    if (data.pickRole === WELLHEAD_PICK_ROLE && typeof data.wellIndex === 'number') {
      return data.wellIndex;
    }
  }
  return null;
}

export function isPointerClick(
  down: { x: number; y: number },
  up: { x: number; y: number },
  thresholdPx = PICK_DRAG_THRESHOLD_PX,
): boolean {
  return Math.hypot(up.x - down.x, up.y - down.y) <= thresholdPx;
}

export function buildWellheadMarkers(
  wellsLocal: PlanVertex[],
  kbM: number,
  options: BuildWellheadMarkersOptions = {},
): THREE.Group {
  const { selectedWellIndex = null } = options;
  const group = new THREE.Group();
  group.name = 'layer-wellheads';
  const baseRadius = 1.2;
  const height = 2.5;
  wellsLocal.forEach((well, index) => {
    const selected = selectedWellIndex === index;
    const radius = selected ? baseRadius * 1.35 : baseRadius;
    const geometry = new THREE.CylinderGeometry(radius, radius, height, 12);
    const color = wellTrajectoryPaletteColorHex(index);
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.55,
      metalness: 0.1,
      emissive: selected ? color : 0x000000,
      emissiveIntensity: selected ? 0.42 : 0,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(planEastToSceneX(well.east_m), kbM + height / 2, planNorthToSceneZ(well.north_m));
    mesh.userData = { pickRole: WELLHEAD_PICK_ROLE, wellIndex: index };
    group.add(mesh);

    if (selected) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(radius + 0.55, 0.18, 8, 24),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.copy(mesh.position);
      ring.position.y = kbM + 0.15;
      ring.userData = { pickRole: WELLHEAD_PICK_ROLE, wellIndex: index };
      group.add(ring);
    }
  });
  return group;
}

export function buildTrajectoryLines(
  trajectories: WellTrajectory[],
  kbM: number,
  sfWarningThreshold = 1.0,
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'layer-trajectories';
  trajectories.forEach((well, index) => {
    const stations = well.survey?.stations ?? [];
    if (stations.length < 2) return;
    const points: THREE.Vector3[] = [];
    for (const st of stations) {
      const e = Number(st.e ?? 0);
      const n = Number(st.n ?? 0);
      const tvd = Number(st.tvd ?? 0);
      if (!Number.isFinite(e) || !Number.isFinite(n) || !Number.isFinite(tvd)) continue;
      const p = stationToScenePoint(e, n, tvd, kbM);
      points.push(new THREE.Vector3(p.x, p.y, p.z));
    }
    if (points.length < 2) return;
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const minSf = well.clearance?.min_sf;
    const color = wellTrajectoryDisplayColorHex(
      well.well_index ?? index,
      minSf,
      sfWarningThreshold,
    );
    const material = new THREE.LineBasicMaterial({
      color,
      linewidth: 2,
    });
    group.add(new THREE.Line(geometry, material));
  });
  return group;
}

export function buildBottomholeMarkers(trajectories: WellTrajectory[], kbM: number): THREE.Group {
  const group = new THREE.Group();
  group.name = 'bottomhole-markers-from-trajectories';
  trajectories.forEach((well, index) => {
    const target = well.target;
    if (!target?.tvd_m) return;
    const plan = target.plan;
    let east = plan?.east_m;
    let north = plan?.north_m;
    if (east == null || north == null) {
      const stations = well.survey?.stations ?? [];
      const last = stations[stations.length - 1];
      if (last) {
        east = Number(last.e ?? 0);
        north = Number(last.n ?? 0);
      }
    }
    if (east == null || north == null || !Number.isFinite(east) || !Number.isFinite(north)) return;
    const p = stationToScenePoint(east, north, target.tvd_m, kbM);
    const geometry = new THREE.SphereGeometry(1.8, 16, 12);
    const material = new THREE.MeshStandardMaterial({
      color: wellTrajectoryPaletteColorHex(well.well_index ?? index),
      emissive: wellTrajectoryPaletteColorHex(well.well_index ?? index),
      emissiveIntensity: 0.25,
      roughness: 0.4,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(p.x, p.y, p.z);
    group.add(mesh);
  });
  return group;
}

const BOTTOMHOLE_SUBTYPE_COLORS: Record<string, number> = {
  well_bottomhole_nnb: 0x1565c0,
  well_bottomhole_gs: 0x2e7d32,
  well_bottomhole_gs_heel: 0x2e7d32,
  well_bottomhole_gs_toe: 0xc62828,
};

export function lonLatToLocalEnu(
  lon: number,
  lat: number,
  anchorLon: number,
  anchorLat: number,
): { east_m: number; north_m: number } {
  const { lon: mPerDegLon, lat: mPerDegLat } = metersPerDegree(anchorLat);
  return {
    east_m: (lon - anchorLon) * mPerDegLon,
    north_m: (lat - anchorLat) * mPerDegLat,
  };
}

function readBottomholeWellIndex(props: Record<string, unknown> | undefined): number | null {
  const raw = props?.[WELL_BOTTOMHOLE_WELL_INDEX];
  if (raw == null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 63) return null;
  return Math.round(n);
}

function bottomholeMarkerColor(obj: InfraObject, fallbackIndex: number): number {
  if (isLateralBottomhole(obj)) return 0x7b1fa2;
  const idx = readBottomholeWellIndex(obj.properties);
  if (idx != null) return wellTrajectoryPaletteColorHex(idx);
  const bySubtype = BOTTOMHOLE_SUBTYPE_COLORS[obj.subtype];
  if (bySubtype != null) return bySubtype;
  return wellTrajectoryPaletteColorHex(fallbackIndex);
}

function addBottomholeMarker(
  group: THREE.Group,
  lon: number,
  lat: number,
  tvd: number,
  color: number,
  radius: number,
  anchorLon: number,
  anchorLat: number,
  kbM: number,
  userData: Record<string, unknown>,
): void {
  const local = lonLatToLocalEnu(lon, lat, anchorLon, anchorLat);
  const p = stationToScenePoint(local.east_m, local.north_m, tvd, kbM);
  const geometry = new THREE.SphereGeometry(radius, 16, 12);
  const material = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.22,
    roughness: 0.4,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(p.x, p.y, p.z);
  mesh.userData = userData;
  group.add(mesh);
}

function addGsConnectorLine(
  group: THREE.Group,
  heelLon: number,
  heelLat: number,
  toeLon: number,
  toeLat: number,
  heelTvd: number,
  toeTvd: number,
  anchorLon: number,
  anchorLat: number,
  kbM: number,
): void {
  const heelLocal = lonLatToLocalEnu(heelLon, heelLat, anchorLon, anchorLat);
  const toeLocal = lonLatToLocalEnu(toeLon, toeLat, anchorLon, anchorLat);
  const p1 = stationToScenePoint(heelLocal.east_m, heelLocal.north_m, heelTvd, kbM);
  const p2 = stationToScenePoint(toeLocal.east_m, toeLocal.north_m, toeTvd, kbM);
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(p1.x, p1.y, p1.z),
    new THREE.Vector3(p2.x, p2.y, p2.z),
  ]);
  const material = new THREE.LineDashedMaterial({
    color: 0x2e7d32,
    dashSize: 4,
    gapSize: 2,
  });
  const line = new THREE.Line(geometry, material);
  line.computeLineDistances();
  group.add(line);
}

export function buildGsBottomholeConnectorLines(
  bottomholes: InfraObject[],
  anchorLon: number,
  anchorLat: number,
  kbM: number,
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'bottomhole-gs-connectors';
  const byId = new Map(bottomholes.map((o) => [o.id, o]));

  for (const obj of bottomholes) {
    const endpoints = readGsLineEndpoints(obj);
    if (!endpoints) continue;
    const heelTvd = readGsHeelTvdM(obj.properties);
    const toeTvd = readGsToeTvdM(obj.properties);
    addGsConnectorLine(
      group,
      endpoints.heelLon,
      endpoints.heelLat,
      endpoints.toeLon,
      endpoints.toeLat,
      heelTvd,
      toeTvd,
      anchorLon,
      anchorLat,
      kbM,
    );
  }

  for (const conn of buildGsBottomholeConnectors(bottomholes)) {
    const heel = byId.get(conn.heelId);
    const toe = byId.get(conn.toeId);
    if (!heel || !toe) continue;
    addGsConnectorLine(
      group,
      heel.lon,
      heel.lat,
      toe.lon,
      toe.lat,
      readBottomholeTvdM(heel.properties),
      readBottomholeTvdM(toe.properties),
      anchorLon,
      anchorLat,
      kbM,
    );
  }
  return group;
}

export function buildBottomholeMarkersFromInfra(
  bottomholes: InfraObject[],
  anchorLon: number,
  anchorLat: number,
  kbM: number,
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'bottomhole-markers-from-infra';
  bottomholes.forEach((obj, index) => {
    const endpoints = readGsLineEndpoints(obj);
    if (endpoints) {
      const heelTvd = readGsHeelTvdM(obj.properties);
      const toeTvd = readGsToeTvdM(obj.properties);
      addBottomholeMarker(
        group,
        endpoints.heelLon,
        endpoints.heelLat,
        heelTvd,
        BOTTOMHOLE_SUBTYPE_COLORS.well_bottomhole_gs_heel,
        1.5,
        anchorLon,
        anchorLat,
        kbM,
        { bottomholeId: obj.id, subtype: 'well_bottomhole_gs_heel', gsRole: 'heel' },
      );
      addBottomholeMarker(
        group,
        endpoints.toeLon,
        endpoints.toeLat,
        toeTvd,
        BOTTOMHOLE_SUBTYPE_COLORS.well_bottomhole_gs_toe,
        1.5,
        anchorLon,
        anchorLat,
        kbM,
        { bottomholeId: obj.id, subtype: 'well_bottomhole_gs_toe', gsRole: 'toe' },
      );
      return;
    }
    const radius = obj.subtype === 'well_bottomhole_nnb' ? 1.8 : 1.5;
    const color = bottomholeMarkerColor(obj, index);
    const tvd = readBottomholeTvdM(obj.properties);
    addBottomholeMarker(
      group,
      obj.lon,
      obj.lat,
      tvd,
      color,
      radius,
      anchorLon,
      anchorLat,
      kbM,
      { bottomholeId: obj.id, subtype: obj.subtype },
    );
  });
  return group;
}

export function bottomholesSceneRevision(bottomholes: InfraObject[]): string {
  return bottomholes
    .map((o) => {
      const idx = readBottomholeWellIndex(o.properties);
      const endpoints = readGsLineEndpoints(o);
      const endPart =
        endpoints != null ? `:${endpoints.toeLon}:${endpoints.toeLat}` : '';
      const tvdPart = endpoints
        ? `${readGsHeelTvdM(o.properties)}:${readGsToeTvdM(o.properties)}`
        : String(readBottomholeTvdM(o.properties));
      return `${o.id}:${o.lon}:${o.lat}${endPart}:${tvdPart}:${o.subtype}:${idx ?? ''}`;
    })
    .join('|');
}

export type BottomholeLabelAnchor = {
  id: string;
  label: string;
  eastM: number;
  northM: number;
  tvdM: number;
  gsRole?: 'heel' | 'toe';
};

function bottomholeDisplayLabel(obj: InfraObject, gsRole?: 'heel' | 'toe'): string {
  const base = obj.name?.trim() || 'Забой';
  if (gsRole === 'heel') return `${base} · ${GS_HEEL_LABEL}`;
  if (gsRole === 'toe') return `${base} · ${GS_TOE_LABEL}`;
  return base;
}

/** Screen labels for bottomhole markers (infra GS/NNB or trajectory targets). */
export function collectBottomholeLabelAnchors(
  bottomholes: InfraObject[],
  trajectories: WellTrajectory[],
  anchorLon: number,
  anchorLat: number,
): BottomholeLabelAnchor[] {
  const out: BottomholeLabelAnchor[] = [];

  if (bottomholes.length > 0) {
    for (const obj of bottomholes) {
      const endpoints = readGsLineEndpoints(obj);
      if (endpoints) {
        const heelLocal = lonLatToLocalEnu(endpoints.heelLon, endpoints.heelLat, anchorLon, anchorLat);
        const toeLocal = lonLatToLocalEnu(endpoints.toeLon, endpoints.toeLat, anchorLon, anchorLat);
        out.push({
          id: `${obj.id}:heel`,
          label: bottomholeDisplayLabel(obj, 'heel'),
          eastM: heelLocal.east_m,
          northM: heelLocal.north_m,
          tvdM: readGsHeelTvdM(obj.properties),
          gsRole: 'heel',
        });
        out.push({
          id: `${obj.id}:toe`,
          label: bottomholeDisplayLabel(obj, 'toe'),
          eastM: toeLocal.east_m,
          northM: toeLocal.north_m,
          tvdM: readGsToeTvdM(obj.properties),
          gsRole: 'toe',
        });
        continue;
      }
      const local = lonLatToLocalEnu(obj.lon, obj.lat, anchorLon, anchorLat);
      out.push({
        id: obj.id,
        label: bottomholeDisplayLabel(obj),
        eastM: local.east_m,
        northM: local.north_m,
        tvdM: readBottomholeTvdM(obj.properties),
      });
    }
    return out;
  }

  trajectories.forEach((well, index) => {
    const target = well.target;
    if (!target?.tvd_m) return;
    const plan = target.plan;
    let east = plan?.east_m;
    let north = plan?.north_m;
    if (east == null || north == null) {
      const stations = well.survey?.stations ?? [];
      const last = stations[stations.length - 1];
      if (last) {
        east = Number(last.e ?? 0);
        north = Number(last.n ?? 0);
      }
    }
    if (east == null || north == null || !Number.isFinite(east) || !Number.isFinite(north)) return;
    const wi = well.well_index ?? index;
    out.push({
      id: `traj-bh:${wi}`,
      label: `${clusteringWellLabel(wi, well.name)} · забой`,
      eastM: east,
      northM: north,
      tvdM: target.tvd_m,
    });
  });

  return out;
}

function lateralBranchPlanEndpointsFromPyWellGeoSegments(
  segments: PyWellGeoPlotSegment[],
  padId: string,
  wellIndex: number,
  anchorLon: number,
  anchorLat: number,
): LateralBranchPlanEndpoint[] {
  const { lon: mPerDegLon, lat: mPerDegLat } = metersPerDegree(anchorLat);
  const out: LateralBranchPlanEndpoint[] = [];
  for (const seg of segments) {
    const name = (seg.name || '').toLowerCase();
    if (name === 'main') continue;
    const east = seg.to_xyz[0];
    const north = seg.to_xyz[1];
    if (!Number.isFinite(east) || !Number.isFinite(north)) continue;
    out.push({
      padId,
      wellIndex,
      lon: anchorLon + east / mPerDegLon,
      lat: anchorLat + north / mPerDegLat,
    });
  }
  return out;
}

export type BuildBottomholeLayerOptions = {
  padId?: string;
  pywellgeoSegments?: PyWellGeoPlotSegment[];
  pywellgeoWellIndex?: number | null;
};

export function buildLateralBottomholeConnectorLines(
  bottomholes: InfraObject[],
  anchorLon: number,
  anchorLat: number,
  kbM: number,
  options?: BuildBottomholeLayerOptions,
): THREE.Group {
  const padId = options?.padId;
  const wellIndex = options?.pywellgeoWellIndex;
  const segments = options?.pywellgeoSegments ?? [];
  const covered =
    padId && wellIndex != null && segments.length > 0
      ? lateralBottomholeIdsWithBranchCoverage(
          bottomholes,
          lateralBranchPlanEndpointsFromPyWellGeoSegments(
            segments,
            padId,
            wellIndex,
            anchorLon,
            anchorLat,
          ),
        )
      : undefined;

  const group = new THREE.Group();
  group.name = 'layer-lateral-bottomhole-connectors';
  for (const conn of buildLateralBottomholeConnectors(bottomholes, { excludeLateralIds: covered })) {
    const parent = bottomholes.find((o) => o.id === conn.parentId);
    const lateral = bottomholes.find((o) => o.id === conn.lateralId);
    if (!parent || !lateral) continue;
    const parentProps = parent.properties ?? {};
    const lateralProps = lateral.properties ?? {};
    const parentTvd = readBottomholeTvdM(parentProps);
    const lateralTvd = readBottomholeTvdM(lateralProps);
    addGsConnectorLine(
      group,
      conn.coordinates[0]![0]!,
      conn.coordinates[0]![1]!,
      conn.coordinates[1]![0]!,
      conn.coordinates[1]![1]!,
      parentTvd,
      lateralTvd,
      anchorLon,
      anchorLat,
      kbM,
    );
  }
  return group;
}

export function buildBottomholeLayer(
  bottomholes: InfraObject[],
  trajectories: WellTrajectory[],
  anchorLon: number,
  anchorLat: number,
  kbM: number,
  options?: BuildBottomholeLayerOptions,
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'layer-bottomholes';

  if (bottomholes.length > 0) {
    group.add(buildGsBottomholeConnectorLines(bottomholes, anchorLon, anchorLat, kbM));
    group.add(buildLateralBottomholeConnectorLines(bottomholes, anchorLon, anchorLat, kbM, options));
    group.add(buildBottomholeMarkersFromInfra(bottomholes, anchorLon, anchorLat, kbM));
  } else if (trajectories.length > 0) {
    const fromTraj = buildBottomholeMarkers(trajectories, kbM);
    for (const child of fromTraj.children) {
      group.add(child);
    }
  }

  return group;
}
