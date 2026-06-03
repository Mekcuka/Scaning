import { describe, expect, it, vi } from 'vitest';
import Feature from 'ol/Feature';
import LineString from 'ol/geom/LineString';
import Point from 'ol/geom/Point';
import { fromLonLat } from 'ol/proj';
import {
  applyVectorLayerUpdateWhileInteracting,
  resolveInnerLayerFeature,
  shouldUpdateVectorLayerWhileInteracting,
  syncOuterGeometryToInnerFeature,
  syncOuterGeometryToInnerFeatures,
} from './mapFeatureGeometrySync';

function methanolPointFeature(lon: number, lat: number): Feature {
  return new Feature({
    geometry: new Point(fromLonLat([lon, lat])),
    id: 'mf-1',
    subtype: 'methanol_facility',
    featureKind: 'infra',
  });
}

describe('resolveInnerLayerFeature', () => {
  it('returns the same feature when not wrapped', () => {
    const f = methanolPointFeature(37.6, 55.75);
    expect(resolveInnerLayerFeature(f)).toBe(f);
  });

  it('returns the single member when wrapped in a collection', () => {
    const inner = methanolPointFeature(37.6, 55.75);
    const outer = new Feature({ features: [inner] });
    outer.setGeometry(new Point(fromLonLat([38, 56])));
    expect(resolveInnerLayerFeature(outer)).toBe(inner);
  });
});

describe('syncOuterGeometryToInnerFeature', () => {
  it('copies moved point geometry to inner feature (methanol drag case)', () => {
    const inner = methanolPointFeature(37.6, 55.75);
    const outer = new Feature({ features: [inner] });
    const moved = new Point(fromLonLat([37.7, 55.8]));
    outer.setGeometry(moved);

    expect(syncOuterGeometryToInnerFeature(outer)).toBe(true);

    const innerGeom = inner.getGeometry() as Point;
    expect(innerGeom.getCoordinates()).toEqual(moved.getCoordinates());
    expect((outer.getGeometry() as Point).getCoordinates()).toEqual(moved.getCoordinates());
  });

  it('copies moved line geometry to inner feature', () => {
    const inner = new Feature({
      id: 'line-1',
      subtype: 'water_pipeline',
      featureKind: 'infra',
      geometry: new LineString([
        fromLonLat([37.6, 55.75]),
        fromLonLat([37.61, 55.76]),
      ]),
    });
    const outer = new Feature({ features: [inner] });
    const moved = new LineString([
      fromLonLat([37.7, 55.8]),
      fromLonLat([37.71, 55.81]),
    ]);
    outer.setGeometry(moved);

    expect(syncOuterGeometryToInnerFeature(outer)).toBe(true);
    expect((inner.getGeometry() as LineString).getCoordinates()).toEqual(moved.getCoordinates());
  });

  it('returns false when outer is not a wrapper', () => {
    const f = methanolPointFeature(37.6, 55.75);
    f.setGeometry(new Point(fromLonLat([37.7, 55.8])));
    expect(syncOuterGeometryToInnerFeature(f)).toBe(false);
  });

  it('returns false when outer has no point or line geometry', () => {
    const inner = methanolPointFeature(37.6, 55.75);
    const outer = new Feature({ features: [inner] });
    expect(syncOuterGeometryToInnerFeature(outer)).toBe(false);
  });
});

describe('syncOuterGeometryToInnerFeatures', () => {
  it('syncs each wrapped feature in a selection collection', () => {
    const innerA = methanolPointFeature(37.6, 55.75);
    const innerB = new Feature({
      geometry: new Point(fromLonLat([38, 56])),
      id: 'pt-2',
      subtype: 'substation',
      featureKind: 'infra',
    });
    const outerA = new Feature({ features: [innerA] });
    outerA.setGeometry(new Point(fromLonLat([37.61, 55.751])));
    const outerB = new Feature({ features: [innerB] });
    outerB.setGeometry(new Point(fromLonLat([38.01, 56.01])));

    expect(syncOuterGeometryToInnerFeatures([outerA, outerB])).toBe(2);
    expect((innerA.getGeometry() as Point).getCoordinates()).toEqual(
      (outerA.getGeometry() as Point).getCoordinates(),
    );
    expect((innerB.getGeometry() as Point).getCoordinates()).toEqual(
      (outerB.getGeometry() as Point).getCoordinates(),
    );
  });
});

describe('shouldUpdateVectorLayerWhileInteracting', () => {
  it('is true only in map edit mode', () => {
    expect(shouldUpdateVectorLayerWhileInteracting(true)).toBe(true);
    expect(shouldUpdateVectorLayerWhileInteracting(false)).toBe(false);
  });
});

describe('applyVectorLayerUpdateWhileInteracting', () => {
  it('sets updateWhileInteracting on point and line layers via OL set()', () => {
    const point = { set: vi.fn() };
    const line = { set: vi.fn() };
    applyVectorLayerUpdateWhileInteracting(point, line, true);
    expect(point.set).toHaveBeenCalledWith('updateWhileInteracting', true);
    expect(line.set).toHaveBeenCalledWith('updateWhileInteracting', true);
    applyVectorLayerUpdateWhileInteracting(point, line, false);
    expect(point.set).toHaveBeenCalledWith('updateWhileInteracting', false);
    expect(line.set).toHaveBeenCalledWith('updateWhileInteracting', false);
  });
});
