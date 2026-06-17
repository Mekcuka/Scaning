import { describe, expect, it } from 'vitest';
import type { InfraObject } from '../api';
import { getLineCoordinates, lineEndpointHealPayload, linePathForDisplay } from '../infraGeometry';
import { resolveFootprintLonLat } from '../padFootprintGeo';
import { lonLatOnFootprintEdge } from '../padFootprintLineAttach';

const node = (lon: number, lat: number): InfraObject =>
  ({
    id: 'node-1',
    name: 'Узел_1',
    subtype: 'node',
    lon,
    lat,
  }) as InfraObject;

const powerLine = (coords: [number, number][]): InfraObject =>
  ({
    id: 'lep-1',
    name: 'ЛЭП_1',
    subtype: 'power_line',
    category: 'linear',
    layer_id: 'layer-1',
    lon: coords[0]![0],
    lat: coords[0]![1],
    end_lon: coords[coords.length - 1]![0],
    end_lat: coords[coords.length - 1]![1],
    coordinates: coords,
  }) as InfraObject;

describe('linePathForDisplay', () => {
  it('snaps line ends to node when within tolerance', () => {
    const n = node(37.7, 55.85);
    const l = powerLine([
      [37.6, 55.75],
      [37.65, 55.8],
      [37.70005, 55.85005],
    ]);
    const path = linePathForDisplay(l, [n]);
    expect(path).not.toBeNull();
    expect(path![path!.length - 1]).toEqual([37.7, 55.85]);
  });

  it('lod endpoints returns only two vertices after snap', () => {
    const n = node(37.7, 55.85);
    const l = powerLine([
      [37.6, 55.75],
      [37.65, 55.8],
      [37.70005, 55.85005],
    ]);
    const path = linePathForDisplay(l, [n], { lod: 'endpoints' });
    expect(path).toHaveLength(2);
    expect(path![0]).toEqual([37.6, 55.75]);
    expect(path![1]).toEqual([37.7, 55.85]);
  });

  it('footprints symbology applies edge attach for display', () => {
    const pad = {
      id: 'pad-1',
      subtype: 'oil_pad',
      lon: 37.6,
      lat: 55.75,
      properties: { pad_length_m: 120, pad_width_m: 80 },
    } as InfraObject;
    const ring = resolveFootprintLonLat(pad)!;
    const edgePt = lonLatOnFootprintEdge(ring, 2, 0.5)!;
    const l = powerLine([
      [pad.lon, pad.lat],
      [37.65, 55.76],
    ]);
    l.properties = {
      line_footprint_attach: { start: { point_id: 'pad-1', edge_index: 2, t: 0.5 } },
    };
    const path = linePathForDisplay(l, [pad], { infraSymbology: 'footprints' });
    expect(path![0]![0]).toBeCloseTo(edgePt[0], 9);
    expect(path![0]![1]).toBeCloseTo(edgePt[1], 9);
    const centerPath = linePathForDisplay(l, [pad]);
    expect(centerPath![0]).toEqual([pad.lon, pad.lat]);
  });
});

describe('getLineCoordinates', () => {
  it('prefers lon/end_lon over stale coordinates for GS bottomhole', () => {
    const gs = {
      id: 'gs-1',
      subtype: 'well_bottomhole_gs',
      lon: 37.611,
      lat: 55.711,
      end_lon: 37.621,
      end_lat: 55.712,
      coordinates: [
        [37.61, 55.71],
        [37.62, 55.71],
      ],
    } as InfraObject;
    expect(getLineCoordinates(gs)).toEqual([
      [37.611, 55.711],
      [37.621, 55.712],
    ]);
    expect(linePathForDisplay(gs, [])).toEqual([
      [37.611, 55.711],
      [37.621, 55.712],
    ]);
  });
});

describe('lineEndpointHealPayload', () => {
  it('returns patch when stored ends differ from snap', () => {
    const n = node(37.7, 55.85);
    const l = powerLine([
      [37.6, 55.75],
      [37.70005, 55.85005],
    ]);
    const payload = lineEndpointHealPayload(l, [n]);
    expect(payload).not.toBeNull();
    expect(payload!.end_lon).toBe(37.7);
    expect(payload!.end_lat).toBe(55.85);
  });
});
