import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  buildWellheadMarkers,
  kbFromPad,
  stationToScenePoint,
  trajectoriesAlignWithWells,
  WELLHEAD_PICK_ROLE,
} from './padClusteringScene3d';
import type { WellTrajectory } from './api/wellTrajectoryApi';

describe('padClusteringScene3d', () => {
  it('stationToScenePoint converts ENU + TVD to scene Y = KB − TVD', () => {
    const kb = kbFromPad(100, 2);
    expect(kb).toBe(102);
    const p = stationToScenePoint(10, 20, 500, kb);
    expect(p).toEqual({ x: -10, y: 102 - 500, z: 20 });
  });

  it('stationToScenePoint at surface has y near KB', () => {
    const kb = 50;
    const p = stationToScenePoint(0, 0, 0, kb);
    expect(p.y).toBe(50);
  });

  it('trajectoriesAlignWithWells compares head station to local wellheads', () => {
    const wells = [
      { east_m: 0, north_m: 0 },
      { east_m: 9, north_m: 0 },
    ];
    const aligned: WellTrajectory[] = [
      {
        well_index: 0,
        survey: { stations: [{ e: 0, n: 0, tvd: 0 }] },
      },
      {
        well_index: 1,
        survey: { stations: [{ e: 9, n: 0, tvd: 0 }] },
      },
    ];
    const stale: WellTrajectory[] = [
      {
        well_index: 0,
        survey: { stations: [{ e: 0, n: 0, tvd: 0 }] },
      },
      {
        well_index: 1,
        survey: { stations: [{ e: 9, n: 50, tvd: 0 }] },
      },
    ];
    expect(trajectoriesAlignWithWells(aligned, wells)).toBe(true);
    expect(trajectoriesAlignWithWells(stale, wells)).toBe(false);
  });

  it('returns false when trajectory count differs from wells', () => {
    const wells = [{ east_m: 0, north_m: 0 }];
    const trajectories: WellTrajectory[] = [
      { well_index: 0, survey: { stations: [{ e: 0, n: 0, tvd: 0 }] } },
      { well_index: 1, survey: { stations: [{ e: 9, n: 0, tvd: 0 }] } },
    ];
    expect(trajectoriesAlignWithWells(trajectories, wells)).toBe(false);
  });

  it('returns false when head station is missing', () => {
    const wells = [{ east_m: 0, north_m: 0 }];
    const trajectories: WellTrajectory[] = [{ well_index: 0, survey: { stations: [] } }];
    expect(trajectoriesAlignWithWells(trajectories, wells)).toBe(false);
  });

  it('buildWellheadMarkers sets pick userData on meshes', () => {
    const group = buildWellheadMarkers(
      [
        { east_m: 1, north_m: 2 },
        { east_m: 3, north_m: 4 },
      ],
      100,
    );
    const meshes = group.children.filter((c) => c instanceof THREE.Mesh) as THREE.Mesh[];
    expect(meshes[0]!.userData).toEqual({ pickRole: WELLHEAD_PICK_ROLE, wellIndex: 0 });
    expect(meshes[1]!.userData).toEqual({ pickRole: WELLHEAD_PICK_ROLE, wellIndex: 1 });
  });

  it('buildWellheadMarkers highlights selected well with emissive material', () => {
    const group = buildWellheadMarkers([{ east_m: 0, north_m: 0 }], 100, {
      selectedWellIndex: 0,
    });
    const mesh = group.children.find((c) => c instanceof THREE.Mesh) as THREE.Mesh;
    const material = mesh.material as THREE.MeshStandardMaterial;
    expect(material.emissiveIntensity).toBeGreaterThan(0);
  });
});
