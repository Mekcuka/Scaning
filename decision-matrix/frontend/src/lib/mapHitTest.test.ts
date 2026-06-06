import { describe, expect, it } from 'vitest';
import type OlMap from 'ol/Map';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import LineString from 'ol/geom/LineString';
import VectorSource from 'ol/source/Vector';
import { fromLonLat } from 'ol/proj';
import {
  resolveHoverFeatureIdAtCoordinate,
  resolveInfraPointAtCoordinate,
} from './mapHitTest';

function mockMap(resolution = 10): OlMap {
  return {
    getView: () => ({ getResolution: () => resolution }),
  } as OlMap;
}

describe('resolveInfraPointAtCoordinate', () => {
  it('picks nearest infra point without canvas hit-test', () => {
    const source = new VectorSource();
    source.addFeature(
      new Feature({
        geometry: new Point(fromLonLat([37.6, 55.75])),
        id: 'near',
        subtype: 'substation',
        featureKind: 'infra',
      }),
    );
    source.addFeature(
      new Feature({
        geometry: new Point(fromLonLat([38, 56])),
        id: 'far',
        subtype: 'substation',
        featureKind: 'infra',
      }),
    );
    const coord = fromLonLat([37.601, 55.751]);
    const hit = resolveInfraPointAtCoordinate(mockMap(), source, coord, 80);
    expect(hit?.id).toBe('near');
  });

  it('ignores draft features', () => {
    const source = new VectorSource();
    source.addFeature(
      new Feature({
        geometry: new Point(fromLonLat([10, 20])),
        id: 'draft-1',
        subtype: 'draft',
        featureKind: 'infra',
      }),
    );
    const hit = resolveInfraPointAtCoordinate(
      mockMap(),
      source,
      fromLonLat([10, 20]),
      50,
    );
    expect(hit).toBeNull();
  });
});

describe('resolveHoverFeatureIdAtCoordinate', () => {
  it('finds point when click is on icon edge but not at center', () => {
    const points = new VectorSource();
    const lines = new VectorSource();
    const center = fromLonLat([10, 20]);
    points.addFeature(
      new Feature({
        geometry: new Point(center),
        id: 'pt',
        subtype: 'substation',
        featureKind: 'infra',
      }),
    );
    const resolution = 5;
    const offsetPx = 14;
    const clickCoord: [number, number] = [
      center[0]! + resolution * offsetPx,
      center[1]!,
    ];
    const idAt6 = resolveHoverFeatureIdAtCoordinate(
      mockMap(resolution),
      points,
      lines,
      clickCoord,
      6,
    );
    expect(idAt6).toBeNull();
    const idAt18 = resolveHoverFeatureIdAtCoordinate(
      mockMap(resolution),
      points,
      lines,
      clickCoord,
      18,
    );
    expect(idAt18).toBe('pt');
  });

  it('returns point id when cursor is on the point', () => {
    const points = new VectorSource();
    const lines = new VectorSource();
    points.addFeature(
      new Feature({
        geometry: new Point(fromLonLat([10, 20])),
        id: 'pt',
        subtype: 'substation',
        featureKind: 'infra',
      }),
    );
    const id = resolveHoverFeatureIdAtCoordinate(
      mockMap(5),
      points,
      lines,
      fromLonLat([10, 20]),
      30,
    );
    expect(id).toBe('pt');
  });

  it('prefers regular point over node and line when all are within tolerance', () => {
    const points = new VectorSource();
    const nodes = new VectorSource();
    const lines = new VectorSource();
    lines.addFeature(
      new Feature({
        geometry: new LineString([
          fromLonLat([10, 20]),
          fromLonLat([12, 22]),
        ]),
        id: 'ln',
        subtype: 'autoroad',
        featureKind: 'infra',
      }),
    );
    nodes.addFeature(
      new Feature({
        geometry: new Point(fromLonLat([11, 21])),
        id: 'node',
        subtype: 'node',
        featureKind: 'infra',
      }),
    );
    points.addFeature(
      new Feature({
        geometry: new Point(fromLonLat([11, 21])),
        id: 'sub',
        subtype: 'substation',
        featureKind: 'infra',
      }),
    );
    const id = resolveHoverFeatureIdAtCoordinate(
      mockMap(5),
      points,
      lines,
      fromLonLat([11, 21]),
      50,
      nodes,
    );
    expect(id).toBe('sub');
  });

  it('prefers node over line when both are within tolerance', () => {
    const points = new VectorSource();
    const nodes = new VectorSource();
    const lines = new VectorSource();
    lines.addFeature(
      new Feature({
        geometry: new LineString([
          fromLonLat([10, 20]),
          fromLonLat([12, 22]),
        ]),
        id: 'ln',
        subtype: 'autoroad',
        featureKind: 'infra',
      }),
    );
    nodes.addFeature(
      new Feature({
        geometry: new Point(fromLonLat([11, 21])),
        id: 'node',
        subtype: 'node',
        featureKind: 'infra',
      }),
    );
    const id = resolveHoverFeatureIdAtCoordinate(
      mockMap(5),
      points,
      lines,
      fromLonLat([11, 21]),
      50,
      nodes,
    );
    expect(id).toBe('node');
  });

  it('prefers point over line when both are within tolerance', () => {
    const points = new VectorSource();
    const lines = new VectorSource();
    lines.addFeature(
      new Feature({
        geometry: new LineString([
          fromLonLat([10, 20]),
          fromLonLat([12, 22]),
        ]),
        id: 'ln',
        subtype: 'autoroad',
        featureKind: 'infra',
      }),
    );
    points.addFeature(
      new Feature({
        geometry: new Point(fromLonLat([11, 21])),
        id: 'pt',
        subtype: 'substation',
        featureKind: 'infra',
      }),
    );
    const id = resolveHoverFeatureIdAtCoordinate(
      mockMap(5),
      points,
      lines,
      fromLonLat([11, 21]),
      50,
    );
    expect(id).toBe('pt');
  });

  it('returns line id when cursor is near the line only', () => {
    const points = new VectorSource();
    const lines = new VectorSource();
    lines.addFeature(
      new Feature({
        geometry: new LineString([
          fromLonLat([1, 1]),
          fromLonLat([5, 5]),
        ]),
        id: 'ln',
        subtype: 'pipeline',
        featureKind: 'infra',
      }),
    );
    const id = resolveHoverFeatureIdAtCoordinate(
      mockMap(5),
      points,
      lines,
      fromLonLat([3, 3]),
      50,
    );
    expect(id).toBe('ln');
  });
});
