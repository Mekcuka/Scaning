import { describe, expect, it } from 'vitest';

import type { PyWellGeoPlotSegment } from './api/pywellgeoApi';
import type { WellTrajectory } from './api/wellTrajectoryApi';
import {
  addBranchAtPath,
  emptyTreeNode,
  setNodeAtPath,
} from './padClusteringPyWellGeoSettings';
import {
  doglegAngleDeg,
  enrichIncAziFromCoordinates,
  finalizeProfilePoints,
  findLateralGsMarkerPosition,
  findProfileMarkerPosition,
  incAziFromInterval,
  lateralProfileFromTreePath,
  mainTrajectoryProfile,
  profileFromPlotSegments,
  resolveGsProfileMarkers,
} from './wellTrajectoryProfile';
import { makeInfraPoint } from '../test/fixtures/infra';
import {
  WELL_BOTTOMHOLE_GS_HEEL_ID,
  WELL_BOTTOMHOLE_HEEL_TVD_M,
  WELL_BOTTOMHOLE_PARENT_ID,
  WELL_BOTTOMHOLE_ROLE,
  WELL_BOTTOMHOLE_TOE_TVD_M,
  WELL_BOTTOMHOLE_WELL_INDEX,
} from './wellBottomholeProperties';

describe('wellTrajectoryProfile', () => {
  it('mainTrajectoryProfile maps survey stations', () => {
    const traj: WellTrajectory = {
      well_index: 0,
      survey: {
        stations: [
          { md: 0, tvd: 0, inc: 0, azi: 0 },
          { md: 500, tvd: 480, inc: 30, azi: 90 },
        ],
      },
    };
    const pts = mainTrajectoryProfile(traj);
    expect(pts).toHaveLength(2);
    expect(pts[1]!.md).toBe(500);
    expect(pts[1]!.tvd).toBe(480);
  });

  it('profileFromPlotSegments accumulates MD along segments', () => {
    const segments: PyWellGeoPlotSegment[] = [
      {
        from_xyz: [0, 0, 0],
        to_xyz: [0, 0, -100],
        color: 'black',
        perforated: false,
        name: 'a',
      },
      {
        from_xyz: [0, 0, -100],
        to_xyz: [100, 0, -100],
        color: 'black',
        perforated: false,
        name: 'b',
      },
    ];
    const pts = profileFromPlotSegments(segments);
    expect(pts.length).toBeGreaterThanOrEqual(2);
    expect(pts[pts.length - 1]!.md).toBeCloseTo(200, 0);
    expect(pts[pts.length - 1]!.tvd).toBeCloseTo(100, 0);
  });

  it('lateralProfileFromTreePath walks main bore then lateral branch', () => {
    let root = emptyTreeNode('main');
    root = setNodeAtPath(root, [], { z: 0, x: 0, y: 0 });
    root = addBranchAtPath(root, [], {
      ...emptyTreeNode('main'),
      z: -50,
      x: 0,
      y: 0,
      branches: [],
    });
    const pts = lateralProfileFromTreePath(root, [0, 0]);
    expect(pts.length).toBeGreaterThanOrEqual(2);
    expect(pts[pts.length - 1]!.tvd).toBeGreaterThan(pts[0]!.tvd);
    expect(pts[pts.length - 1]!.md).toBeGreaterThan(0);
  });

  it('enrichIncAziFromCoordinates derives inc/azi from N/E/TVD', () => {
    const raw = [
      { md: 0, tvd: 0, n: 0, e: 0 },
      { md: 30, tvd: 30, n: 0, e: 0 },
      { md: 60, tvd: 59.9, n: -0.79, e: -0.01 },
    ];
    const pts = enrichIncAziFromCoordinates(raw);
    expect(pts[0]!.inc).toBe(0);
    expect(pts[1]!.inc).toBeCloseTo(0, 1);
    expect(pts[2]!.inc).toBeGreaterThan(0);
    expect(pts[2]!.azi).toBeGreaterThanOrEqual(0);
    expect(pts[2]!.azi).toBeLessThan(360);
    const derived = incAziFromInterval(raw[1]!, raw[2]!);
    expect(derived?.inc).toBeCloseTo(pts[2]!.inc!, 2);
  });

  it('finalizeProfilePoints computes DLS from inc/azi', () => {
    const raw = [
      { md: 0, tvd: 0, inc: 0, azi: 0 },
      { md: 30, tvd: 30, inc: 3, azi: 180.41 },
    ];
    const pts = finalizeProfilePoints(raw);
    expect(pts[0]!.dls).toBe(0);
    expect(pts[1]!.dls).toBeCloseTo(doglegAngleDeg(0, 0, 3, 180.41), 2);
    expect(pts[1]!.inc).toBe(3);
    expect(pts[1]!.azi).toBeCloseTo(180.41, 2);
  });

  it('finalizeProfilePoints fills inc/azi then DLS for coordinate-only rows', () => {
    const raw = [
      { md: 0, tvd: 0, n: 0, e: 0 },
      { md: 30, tvd: 30, n: 0, e: 0 },
      { md: 60, tvd: 59.9, n: -0.79, e: -0.01 },
    ];
    const pts = finalizeProfilePoints(raw);
    expect(pts[2]!.inc).toBeGreaterThan(0);
    expect(pts[2]!.azi).toBeGreaterThanOrEqual(0);
    expect(pts[0]!.dls).toBe(0);
    expect(pts[2]!.dls).toBeGreaterThan(0);
  });

  it('findProfileMarkerPosition projects GS target onto trajectory', () => {
    const points = [
      { md: 0, tvd: 0, n: 0, e: 0 },
      { md: 500, tvd: 400, n: 200, e: 0 },
      { md: 1000, tvd: 450, n: 400, e: 0 },
    ];
    const pos = findProfileMarkerPosition(points, { n: 400, e: 0, tvd: 450 });
    expect(pos?.md).toBeCloseTo(1000, 0);
    expect(pos?.tvd).toBeCloseTo(450, 0);
  });

  it('findLateralGsMarkerPosition separates T1 and T3 on near-horizontal profile', () => {
    const points = [
      { md: 0, tvd: 0, n: 0, e: 0 },
      { md: 1000, tvd: 1500, n: 50, e: 30 },
      { md: 1500, tvd: 1520, n: 150, e: 80 },
      { md: 2000, tvd: 1530, n: 350, e: 150 },
      { md: 2500, tvd: 1535, n: 550, e: 220 },
    ];
    const heel = findLateralGsMarkerPosition(points, { n: 150, e: 80, tvd: 1520 }, 'heel');
    const toe = findLateralGsMarkerPosition(points, { n: 550, e: 220, tvd: 1535 }, 'toe');
    expect(heel!.md).toBeLessThan(toe!.md);
    expect(toe!.md - heel!.md).toBeGreaterThan(200);
  });

  it('resolveGsProfileMarkers returns T1 and T3 for GS line bottomhole', () => {
    const padLon = 37.62;
    const padLat = 55.74;
    const gs = makeInfraPoint({
      id: 'gs-1',
      subtype: 'well_bottomhole_gs',
      lon: padLon + 0.001,
      lat: padLat,
      end_lon: padLon + 0.003,
      end_lat: padLat + 0.001,
      properties: {
        [WELL_BOTTOMHOLE_WELL_INDEX]: 0,
        [WELL_BOTTOMHOLE_HEEL_TVD_M]: 1400,
        [WELL_BOTTOMHOLE_TOE_TVD_M]: 1450,
      },
    });
    const points = [
      { md: 0, tvd: 0, n: 0, e: 0 },
      { md: 1200, tvd: 1400, n: 80, e: 40 },
      { md: 1800, tvd: 1450, n: 220, e: 120 },
    ];
    const markers = resolveGsProfileMarkers(points, [gs], {
      id: 'main:0',
      kind: 'main',
      label: 'Скв-1',
      wellIndex: 0,
    }, padLon, padLat);
    expect(markers.map((m) => m.label).sort()).toEqual(['Т1', 'Т3']);
  });

  it('resolveGsProfileMarkers pairs legacy gs heel and toe', () => {
    const heel = makeInfraPoint({
      id: 'heel-1',
      subtype: 'well_bottomhole_gs_heel',
      lon: 37.621,
      lat: 55.741,
      properties: {
        [WELL_BOTTOMHOLE_WELL_INDEX]: 1,
        [WELL_BOTTOMHOLE_HEEL_TVD_M]: 1500,
        [WELL_BOTTOMHOLE_TOE_TVD_M]: 1550,
      },
    });
    const toe = makeInfraPoint({
      id: 'toe-1',
      subtype: 'well_bottomhole_gs_toe',
      lon: 37.625,
      lat: 55.745,
      properties: { [WELL_BOTTOMHOLE_GS_HEEL_ID]: 'heel-1' },
    });
    const points = [
      { md: 0, tvd: 0, n: 0, e: 0 },
      { md: 2000, tvd: 1550, n: 300, e: 200 },
    ];
    const markers = resolveGsProfileMarkers(points, [heel, toe], {
      id: 'main:1',
      kind: 'main',
      label: 'Скв-2',
      wellIndex: 1,
    }, 37.62, 55.74);
    expect(markers).toHaveLength(2);
    expect(markers[0]!.role).toBe('heel');
    expect(markers[1]!.role).toBe('toe');
  });

  it('resolveGsProfileMarkers returns T1/T3 for lateral GS bottomhole', () => {
    const padLon = 37.62;
    const padLat = 55.74;
    const lateralGs = makeInfraPoint({
      id: 'lat-gs-1',
      subtype: 'well_bottomhole_gs',
      lon: padLon + 0.002,
      lat: padLat + 0.001,
      end_lon: padLon + 0.004,
      end_lat: padLat + 0.002,
      properties: {
        [WELL_BOTTOMHOLE_ROLE]: 'lateral',
        [WELL_BOTTOMHOLE_PARENT_ID]: 'main-bh',
        [WELL_BOTTOMHOLE_HEEL_TVD_M]: 1600,
        [WELL_BOTTOMHOLE_TOE_TVD_M]: 1620,
      },
    });
    const points = [
      { md: 0, tvd: 0, n: 0, e: 0 },
      { md: 1500, tvd: 1600, n: 120, e: 80 },
      { md: 1700, tvd: 1620, n: 200, e: 150 },
    ];
    const markers = resolveGsProfileMarkers(points, [lateralGs], {
      id: 'lateral:lat-gs-1',
      kind: 'lateral',
      label: 'Доп. ГС',
      wellIndex: 0,
      bottomholeId: 'lat-gs-1',
    }, padLon, padLat);
    expect(markers.map((m) => m.label).sort()).toEqual(['Т1', 'Т3']);
    expect(markers.find((m) => m.role === 'heel')!.md).toBeLessThan(
      markers.find((m) => m.role === 'toe')!.md,
    );
  });
});
