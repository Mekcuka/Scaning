/** 3D helpers for pad clustering page: wellheads, trajectories, bottomhole targets. */

import * as THREE from 'three';
import type { WellTrajectory } from './api/wellTrajectoryApi';
import type { PlanVertex } from './padEarthworkSketch';
import { planEastToSceneX, planNorthToSceneZ } from './padEarthworkScene3d';
import { clearanceLineColorHex } from './wellTrajectoryClearance';

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

const WELLHEAD_COLORS = [0xf97316, 0x22c55e, 0xa855f7, 0x06b6d4, 0xeab308, 0xef4444];

function wellColor(index: number): number {
  return WELLHEAD_COLORS[index % WELLHEAD_COLORS.length]!;
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
    const color = wellColor(index);
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
    const color =
      minSf != null
        ? clearanceLineColorHex(minSf, sfWarningThreshold)
        : wellColor(well.well_index ?? index);
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
  group.name = 'layer-bottomholes';
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
      color: wellColor(well.well_index ?? index),
      emissive: wellColor(well.well_index ?? index),
      emissiveIntensity: 0.25,
      roughness: 0.4,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(p.x, p.y, p.z);
    group.add(mesh);
  });
  return group;
}
