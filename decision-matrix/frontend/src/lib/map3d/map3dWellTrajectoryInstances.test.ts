import { describe, expect, it } from 'vitest';
import type { WellTrajectoryGeoJsonFeature } from '../api/wellTrajectoryApi';
import {
  buildMap3dWellBottomholeInstances,
  buildMap3dWellPlanLineInstances,
  buildMap3dWellTrajectoryInstances,
  buildMap3dWellTrajectoryLayerData,
  parsePoint3d,
  parseTrajectoryPath3d,
} from './map3dWellTrajectoryInstances';

describe('parseTrajectoryPath3d', () => {
  it('parses lon/lat/z coordinates', () => {
    const parsed = parseTrajectoryPath3d([
      [37.6, 55.75, 120],
      [37.601, 55.751, 115],
    ]);
    expect(parsed).toEqual({
      path: [
        [37.6, 55.75],
        [37.601, 55.751],
      ],
      alts: [120, 115],
    });
  });

  it('defaults missing z to 0', () => {
    const parsed = parseTrajectoryPath3d([
      [37.6, 55.75],
      [37.601, 55.751],
    ]);
    expect(parsed?.alts).toEqual([0, 0]);
  });

  it('returns null for fewer than 2 valid points', () => {
    expect(parseTrajectoryPath3d([[37.6, 55.75]])).toBeNull();
    expect(parseTrajectoryPath3d([])).toBeNull();
  });
});

describe('buildMap3dWellTrajectoryInstances', () => {
  const baseFeature: WellTrajectoryGeoJsonFeature = {
    type: 'Feature',
    properties: {
      kind: 'trajectory',
      well_index: 1,
      name: 'Скв-2',
      infra_object_id: 'pad-1',
      sf_warning_threshold: 1,
      min_sf: 1.5,
    },
    geometry: {
      type: 'LineString',
      coordinates: [
        [37.6, 55.75, 120],
        [37.601, 55.751, 110],
      ],
    },
  };

  it('builds main trajectory instance', () => {
    const [inst] = buildMap3dWellTrajectoryInstances([baseFeature]);
    expect(inst).toMatchObject({
      id: 'pad-1:1',
      wellIndex: 1,
      radiusM: 0.8,
      colorHex: '#1565c0',
    });
    expect(inst?.path).toHaveLength(2);
    expect(inst?.alts).toEqual([120, 110]);
  });

  it('builds pywellgeo lateral branch in yellow', () => {
    const [inst] = buildMap3dWellTrajectoryInstances([
      {
        ...baseFeature,
        properties: {
          ...baseFeature.properties,
          kind: 'pywellgeo_branch',
          branch_name: 'lat1',
          branch_id: '0.2',
        },
      },
    ]);
    expect(inst).toMatchObject({
      id: 'pwg:pad-1:1:0.2',
      colorHex: '#f9a825',
      radiusM: 0.8 * 0.85,
    });
  });

  it('skips non-trajectory and short paths', () => {
    expect(
      buildMap3dWellTrajectoryInstances([
        {
          ...baseFeature,
          properties: { ...baseFeature.properties, kind: 'trajectory_plan' },
        },
        {
          ...baseFeature,
          geometry: { type: 'LineString', coordinates: [[37.6, 55.75, 120]] },
        },
      ]),
    ).toEqual([]);
  });
});

describe('buildMap3dWellBottomholeInstances', () => {
  it('builds sphere instance from bottomhole_target_3d with Z', () => {
    const [inst] = buildMap3dWellBottomholeInstances([
      {
        type: 'Feature',
        properties: {
          kind: 'bottomhole_target_3d',
          well_index: 0,
          name: 'Скв-1',
          infra_object_id: 'pad-1',
        },
        geometry: { type: 'Point', coordinates: [37.62, 55.76, -1350] },
      },
    ]);
    expect(inst).toMatchObject({
      lon: 37.62,
      lat: 55.76,
      altM: -1350,
      radiusM: 4,
      wellIndex: 0,
    });
  });
});

describe('buildMap3dWellPlanLineInstances', () => {
  it('uses Z from bottomhole_target_3d for plan line ends', () => {
    const features: WellTrajectoryGeoJsonFeature[] = [
      {
        type: 'Feature',
        properties: {
          kind: 'trajectory',
          well_index: 0,
          name: 'Скв-1',
          infra_object_id: 'pad-1',
        },
        geometry: {
          type: 'LineString',
          coordinates: [
            [37.6, 55.75, 152],
            [37.601, 55.751, 100],
          ],
        },
      },
      {
        type: 'Feature',
        properties: {
          kind: 'bottomhole_target_3d',
          well_index: 0,
          name: 'Скв-1',
          infra_object_id: 'pad-1',
        },
        geometry: { type: 'Point', coordinates: [37.622, 55.761, -1350] },
      },
      {
        type: 'Feature',
        properties: {
          kind: 'bottomhole_plan_line',
          well_index: 0,
          name: 'Скв-1',
          infra_object_id: 'pad-1',
        },
        geometry: {
          type: 'LineString',
          coordinates: [
            [37.6, 55.75],
            [37.622, 55.761],
          ],
        },
      },
    ];
    const [plan] = buildMap3dWellPlanLineInstances(features);
    expect(plan?.alts).toEqual([152, -1350]);
  });
});

describe('buildMap3dWellTrajectoryLayerData', () => {
  it('respects include flags', () => {
    const features: WellTrajectoryGeoJsonFeature[] = [
      {
        type: 'Feature',
        properties: {
          kind: 'trajectory',
          well_index: 0,
          name: 'Скв-1',
          infra_object_id: 'pad-1',
        },
        geometry: {
          type: 'LineString',
          coordinates: [
            [37.6, 55.75, 152],
            [37.601, 55.751, 100],
          ],
        },
      },
      {
        type: 'Feature',
        properties: {
          kind: 'bottomhole_target_3d',
          well_index: 0,
          name: 'Скв-1',
          infra_object_id: 'pad-1',
        },
        geometry: { type: 'Point', coordinates: [37.622, 55.761, -1350] },
      },
    ];
    const all = buildMap3dWellTrajectoryLayerData(features);
    expect(all.trajectories).toHaveLength(1);
    expect(all.bottomholes).toHaveLength(1);

    const bottomholesOnly = buildMap3dWellTrajectoryLayerData(features, {
      includeTrajectories: false,
      includePlanLines: false,
    });
    expect(bottomholesOnly.trajectories).toEqual([]);
    expect(bottomholesOnly.bottomholes).toHaveLength(1);
  });
});

describe('parsePoint3d', () => {
  it('parses lon/lat/z', () => {
    expect(parsePoint3d([37.6, 55.75, -100])).toEqual({
      lon: 37.6,
      lat: 55.75,
      alt: -100,
    });
  });
});
