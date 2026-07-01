import { describe, expect, it, vi } from 'vitest';
import type { InfraObject } from '../../api';
import { LINE_ELEVATION_PROFILE_JSON } from '../../lineElevationProfile';
import { scaleMap3dMeters } from '../map3dConfig';
import {
  buildLinePath3dFromProfile,
  hasLineProfileFor3d,
} from '../map3dLineProfilePath';
import { LINE_ENDPOINT_ATTACH_HEIGHT_FRAC } from '../map3dLinePathBuild';
import { resolveRender3D } from '../render3d';

function fakeMap(): import('maplibre-gl').Map {
  return { getTerrain: () => null } as import('maplibre-gl').Map;
}

const lineWithProfile = (
  subtype: string,
  points: { chainage_m: number; lon: number; lat: number; elevation_m: number | null }[],
  coords?: [number, number][],
): InfraObject => {
  const path = coords ?? points.map((p) => [p.lon, p.lat] as [number, number]);
  return {
    id: 'line-1',
    name: 'line-1',
    subtype,
    category: 'linear',
    lon: path[0]![0],
    lat: path[0]![1],
    end_lon: path[path.length - 1]![0],
    end_lat: path[path.length - 1]![1],
    coordinates: path,
    layer_id: 'layer-1',
    project_id: 'p1',
    properties: {
      [LINE_ELEVATION_PROFILE_JSON]: {
        total_length_m: 200,
        points,
      },
    },
  } as InfraObject;
};

describe('hasLineProfileFor3d', () => {
  it('returns false without profile', () => {
    const l = lineWithProfile('oil_pipeline', [], [[37.6, 55.75], [37.7, 55.85]]);
    l.properties = {};
    expect(hasLineProfileFor3d(l)).toBe(false);
  });

  it('returns false with fewer than 2 valid elevations', () => {
    const l = lineWithProfile('oil_pipeline', [
      { chainage_m: 0, lon: 37.6, lat: 55.75, elevation_m: 100 },
      { chainage_m: 100, lon: 37.61, lat: 55.76, elevation_m: null },
    ]);
    expect(hasLineProfileFor3d(l)).toBe(false);
  });

  it('returns true with ≥2 valid elevations', () => {
    const l = lineWithProfile('oil_pipeline', [
      { chainage_m: 0, lon: 37.6, lat: 55.75, elevation_m: 100 },
      { chainage_m: 100, lon: 37.61, lat: 55.76, elevation_m: 110 },
    ]);
    expect(hasLineProfileFor3d(l)).toBe(true);
  });
});

describe('buildLinePath3dFromProfile', () => {
  it('builds path and alts from profile points for pipeline', () => {
    const l = lineWithProfile('oil_pipeline', [
      { chainage_m: 0, lon: 37.6, lat: 55.75, elevation_m: 100 },
      { chainage_m: 100, lon: 37.61, lat: 55.76, elevation_m: 110 },
      { chainage_m: 200, lon: 37.62, lat: 55.77, elevation_m: 105 },
    ]);
    const render = resolveRender3D(l.subtype, l.properties);
    render.baseM = 2;

    const built = buildLinePath3dFromProfile(l, render, { map: fakeMap() });
    expect(built).not.toBeNull();
    expect(built!.path).toEqual([
      [37.6, 55.75],
      [37.61, 55.76],
      [37.62, 55.77],
    ]);
    expect(built!.alts).toEqual([102, 112, 107]);
    expect(built!.towerAlts).toEqual([102, 112, 107]);
  });

  it('adds wire lift for power_line and keeps towerAlts at ground', () => {
    const l = lineWithProfile('power_line', [
      { chainage_m: 0, lon: 37.6, lat: 55.75, elevation_m: 50 },
      { chainage_m: 100, lon: 37.61, lat: 55.76, elevation_m: 60 },
    ]);
    const render = resolveRender3D(l.subtype, l.properties);
    const wireLift = scaleMap3dMeters(render.heightM) * LINE_ENDPOINT_ATTACH_HEIGHT_FRAC;

    const built = buildLinePath3dFromProfile(l, render, { map: fakeMap() });
    expect(built!.towerAlts).toEqual([50 + render.baseM, 60 + render.baseM]);
    expect(built!.alts[0]).toBeCloseTo(50 + render.baseM + wireLift, 4);
    expect(built!.alts[1]).toBeCloseTo(60 + render.baseM + wireLift, 4);
  });

  it('overrides endpoint alts when attachments present', async () => {
    const modelsLayer = await import('../map3dModelsLayer');
    vi.spyOn(modelsLayer, 'altitudeForModelPlacement').mockReturnValue(999);

    const pad = {
      id: 'pad-1',
      name: 'pad-1',
      subtype: 'oil_pad',
      category: 'point',
      lon: 37.6,
      lat: 55.75,
      layer_id: 'layer-1',
      project_id: 'p1',
      properties: {},
    } as InfraObject;

    const l = lineWithProfile('oil_pipeline', [
      { chainage_m: 0, lon: 37.6, lat: 55.75, elevation_m: 100 },
      { chainage_m: 100, lon: 37.61, lat: 55.76, elevation_m: 110 },
    ]);

    const render = resolveRender3D(l.subtype, l.properties);
    const built = buildLinePath3dFromProfile(l, render, {
      map: fakeMap(),
      attachments: {
        startAttach: { object: pad, lon: pad.lon, lat: pad.lat },
        finishAttach: null,
      },
    });

    expect(built!.alts[0]).toBe(999);
    expect(built!.alts[1]).toBe(110 + render.baseM);
    vi.restoreAllMocks();
  });

  it('returns null when fewer than 2 valid points remain', () => {
    const l = lineWithProfile('oil_pipeline', [
      { chainage_m: 0, lon: 37.6, lat: 55.75, elevation_m: 100 },
      { chainage_m: 100, lon: 37.61, lat: 55.76, elevation_m: null },
    ]);
    const render = resolveRender3D(l.subtype, l.properties);
    expect(buildLinePath3dFromProfile(l, render, { map: fakeMap() })).toBeNull();
  });
});
