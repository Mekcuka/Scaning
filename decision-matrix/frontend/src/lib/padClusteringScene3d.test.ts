import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { InfraObject } from './api';
import {
  bottomholesSceneRevision,
  buildBottomholeLayer,
  buildBottomholeMarkersFromInfra,
  buildGsBottomholeConnectorLines,
  buildWellheadMarkers,
  kbFromPad,
  lonLatToLocalEnu,
  stationToScenePoint,
  trajectoriesAlignWithWells,
  WELLHEAD_PICK_ROLE,
} from './padClusteringScene3d';
import type { WellTrajectory } from './api/wellTrajectoryApi';
import { WELL_BOTTOMHOLE_GS_HEEL_ID, WELL_BOTTOMHOLE_TVD_M, WELL_BOTTOMHOLE_WELL_INDEX } from './wellBottomholeProperties';

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

  it('lonLatToLocalEnu converts relative to anchor', () => {
    const anchorLon = 60;
    const anchorLat = 55;
    const local = lonLatToLocalEnu(60.001, 55.001, anchorLon, anchorLat);
    expect(local.east_m).toBeGreaterThan(0);
    expect(local.north_m).toBeGreaterThan(0);
  });

  it('buildBottomholeMarkersFromInfra places spheres from infra lon/lat', () => {
    const bottomholes: InfraObject[] = [
      {
        id: 'bh-1',
        project_id: 'p',
        name: 'NNB 1',
        subtype: 'well_bottomhole_nnb',
        lon: 60.001,
        lat: 55.001,
        properties: {
          [WELL_BOTTOMHOLE_TVD_M]: 2500,
          [WELL_BOTTOMHOLE_WELL_INDEX]: 0,
        },
      },
    ];
    const group = buildBottomholeMarkersFromInfra(bottomholes, 60, 55, 100);
    expect(group.name).toBe('bottomhole-markers-from-infra');
    expect(group.children).toHaveLength(1);
  });

  it('buildGsBottomholeConnectorLines adds dashed line between heel and toe', () => {
    const bottomholes: InfraObject[] = [
      {
        id: 'heel-1',
        project_id: 'p',
        name: 'Heel',
        subtype: 'well_bottomhole_gs_heel',
        lon: 60,
        lat: 55,
        properties: { [WELL_BOTTOMHOLE_TVD_M]: 2400 },
      },
      {
        id: 'toe-1',
        project_id: 'p',
        name: 'Toe',
        subtype: 'well_bottomhole_gs_toe',
        lon: 60.002,
        lat: 55,
        properties: { [WELL_BOTTOMHOLE_GS_HEEL_ID]: 'heel-1' },
      },
    ];
    const group = buildGsBottomholeConnectorLines(bottomholes, 60, 55, 100);
    expect(group.name).toBe('bottomhole-gs-connectors');
    expect(group.children).toHaveLength(1);
  });

  it('buildBottomholeLayer prefers infra markers when bottomholes present', () => {
    const bottomholes: InfraObject[] = [
      {
        id: 'bh-1',
        project_id: 'p',
        name: 'NNB',
        subtype: 'well_bottomhole_nnb',
        lon: 60.001,
        lat: 55,
        properties: { [WELL_BOTTOMHOLE_TVD_M]: 2500 },
      },
    ];
    const trajectories: WellTrajectory[] = [
      { well_index: 0, target: { tvd_m: 2500, plan: { east_m: 50, north_m: 0 } } },
    ];
    const layer = buildBottomholeLayer(bottomholes, trajectories, 60, 55, 100);
    expect(layer.name).toBe('layer-bottomholes');
    expect(layer.getObjectByName('bottomhole-markers-from-infra')).toBeTruthy();
  });

  it('bottomholesSceneRevision changes when coordinates change', () => {
    const base: InfraObject[] = [
      {
        id: 'bh-1',
        project_id: 'p',
        name: 'NNB',
        subtype: 'well_bottomhole_nnb',
        lon: 60,
        lat: 55,
        properties: { [WELL_BOTTOMHOLE_TVD_M]: 2500 },
      },
    ];
    const moved = [{ ...base[0]!, lon: 60.001 }];
    expect(bottomholesSceneRevision(base)).not.toBe(bottomholesSceneRevision(moved));
  });
});
