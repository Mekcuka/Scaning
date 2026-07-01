import { describe, expect, it } from 'vitest';
import type { InfraObject } from '../api';
import {
  applyFootprintDisplayEndpoints,
  applyFootprintTemplateToObject,
  connectionsFromCardinalTemplate,
  findFootprintEdgeByCardinal,
  cardinalDirectionFromEdgeIndex,
  footprintAttachCardinalSelectValue,
  footprintAttachFromCardinalSelect,
  footprintRingEdges,
  lonLatOnFootprintEdge,
  mergeLineFootprintEndpointAttach,
  nearestFootprintEdge,
  readLineFootprintAttach,
  readPointFootprintLineConnections,
  resolveValidFootprintEndpointAttach,
  writeLineFootprintAttach,
  writePointFootprintLineConnections,
} from '../padFootprintLineAttach';
import { footprintCornersLonLat, resolveFootprintLonLat } from '../padFootprintGeo';

const pad = (id: string, lon: number, lat: number): InfraObject =>
  ({
    id,
    name: 'Pad',
    subtype: 'oil_pad',
    lon,
    lat,
    properties: { pad_length_m: 120, pad_width_m: 80 },
  }) as InfraObject;

const line = (
  start: [number, number],
  finish: [number, number],
  properties?: Record<string, unknown>,
): InfraObject =>
  ({
    id: 'line-1',
    name: 'Line',
    subtype: 'oil_pipeline',
    lon: start[0],
    lat: start[1],
    end_lon: finish[0],
    end_lat: finish[1],
    coordinates: [start, finish],
    properties,
  }) as InfraObject;

describe('padFootprintLineAttach', () => {
  it('reads and writes attach schema', () => {
    const props = writeLineFootprintAttach({}, {
      start: { point_id: 'p1', edge_index: 0, t: 0.25 },
    });
    expect(readLineFootprintAttach(props).start).toEqual({
      point_id: 'p1',
      edge_index: 0,
      t: 0.25,
    });
    expect(readLineFootprintAttach(writeLineFootprintAttach(props, null))).toEqual({});
  });

  it('lonLatOnFootprintEdge returns midpoint', () => {
    const ring = footprintCornersLonLat(37.6, 55.75, 120, 80, 0);
    const closed = [...ring, ring[0]!];
    const pt = lonLatOnFootprintEdge(closed, 0, 0.5);
    expect(pt).not.toBeNull();
    const a = closed[0]!;
    const b = closed[1]!;
    expect(pt![0]).toBeCloseTo((a[0] + b[0]) / 2, 9);
    expect(pt![1]).toBeCloseTo((a[1] + b[1]) / 2, 9);
  });

  it('nearestFootprintEdge picks closest edge', () => {
    const ring = footprintCornersLonLat(37.6, 55.75, 120, 80, 0);
    const closed = [...ring, ring[0]!];
    const mid = lonLatOnFootprintEdge(closed, 1, 0.5)!;
    const hit = nearestFootprintEdge(closed, mid);
    expect(hit?.edgeIndex).toBe(1);
    expect(hit?.t).toBeCloseTo(0.5, 2);
  });

  it('footprintRingEdges labels rectangle with cardinal', () => {
    const ring = footprintCornersLonLat(37.6, 55.75, 120, 80, 0);
    const closed = [...ring, ring[0]!];
    const edges = footprintRingEdges(closed);
    expect(edges).toHaveLength(4);
    expect(edges[0]!.label).toMatch(/\(1\)/);
  });

  it('applyFootprintDisplayEndpoints moves ends to edge when valid', () => {
    const p = pad('pad-1', 37.6, 55.75);
    const ring = resolveFootprintLonLat(p)!;
    const edgePt = lonLatOnFootprintEdge(ring, 2, 0.5)!;
    const l = line(
      [p.lon, p.lat],
      [37.65, 55.76],
      {
        line_footprint_attach: {
          start: { point_id: 'pad-1', edge_index: 2, t: 0.5 },
        },
      },
    );
    const path = applyFootprintDisplayEndpoints(
      [
        [p.lon, p.lat],
        [37.65, 55.76],
      ],
      l,
      [p],
    );
    expect(path[0]![0]).toBeCloseTo(edgePt[0], 9);
    expect(path[0]![1]).toBeCloseTo(edgePt[1], 9);
    expect(path[1]).toEqual([37.65, 55.76]);
  });

  it('BKNS rotation 180: east is edge index 3 not 0', () => {
    const bkns = {
      id: 'c8a91c36-a477-4db6-a2c5-f5bb850fe572',
      subtype: 'ground_pumping_station',
      lon: 37.3847751186604,
      lat: 55.83597526020202,
      properties: { pad_length_m: 120, pad_width_m: 80, pad_rotation_deg: 180 },
    } as InfraObject;
    const ring = resolveFootprintLonLat(bkns)!;
    const east = findFootprintEdgeByCardinal(ring, 'east');
    expect(east?.edgeIndex).toBe(3);
    expect(cardinalDirectionFromEdgeIndex(ring, east!.edgeIndex)).toBe('east');
    expect(cardinalDirectionFromEdgeIndex(ring, 0)).toBe('north');
    expect(footprintRingEdges(ring)[0]!.label.startsWith('Север')).toBe(true);
    const eastPt = lonLatOnFootprintEdge(ring, east!.edgeIndex, 0.5)!;
    expect(eastPt[0]).toBeGreaterThan(bkns.lon);
  });

  it('ignores attach when endpoint not center-snapped to point', () => {
    const p = pad('pad-1', 37.6, 55.75);
    const l = line(
      [37.61, 55.751],
      [37.65, 55.76],
      {
        line_footprint_attach: {
          start: { point_id: 'pad-1', edge_index: 0 },
        },
      },
    );
    const raw: [number, number][] = [
      [37.61, 55.751],
      [37.65, 55.76],
    ];
    const path = applyFootprintDisplayEndpoints(raw, l, [p]);
    expect(path[0]).toEqual(raw[0]);
  });

  it('resolveValidFootprintEndpointAttach validates snap', () => {
    const p = pad('pad-1', 37.6, 55.75);
    const l = line([p.lon, p.lat], [37.65, 55.76]);
    expect(
      resolveValidFootprintEndpointAttach(
        'start',
        l,
        { point_id: 'pad-1', edge_index: 0 },
        [p],
      ),
    ).not.toBeNull();
    expect(
      resolveValidFootprintEndpointAttach(
        'start',
        l,
        { point_id: 'other', edge_index: 0 },
        [p],
      ),
    ).toBeNull();
  });

  it('applyFootprintDisplayEndpoints uses point footprint_line_connections', () => {
    const p = pad('pad-1', 37.6, 55.75);
    const ring = resolveFootprintLonLat(p)!;
    const edgePt = lonLatOnFootprintEdge(ring, 2, 0.5)!;
    const pointWithConn = {
      ...p,
      properties: {
        footprint_line_connections: {
          oil_pipeline: { edge_index: 2, t: 0.5 },
        },
      },
    } as InfraObject;
    const l = line([p.lon, p.lat], [37.65, 55.76]);
    const path = applyFootprintDisplayEndpoints(
      [
        [p.lon, p.lat],
        [37.65, 55.76],
      ],
      l,
      [pointWithConn],
    );
    expect(path[0]![0]).toBeCloseTo(edgePt[0], 9);
    expect(path[0]![1]).toBeCloseTo(edgePt[1], 9);
  });

  it('reads and writes point footprint_line_connections', () => {
    const props = writePointFootprintLineConnections({}, {
      gas_pipeline: { edge_index: 1, t: 0.3 },
    });
    expect(readPointFootprintLineConnections(props).gas_pipeline).toEqual({
      edge_index: 1,
      t: 0.3,
    });
  });

  it('mergeLineFootprintEndpointAttach updates one endpoint', () => {
    const props = mergeLineFootprintEndpointAttach({}, 'finish', {
      point_id: 'p2',
      edge_index: 1,
    });
    expect(readLineFootprintAttach(props).finish?.point_id).toBe('p2');
  });

  it('connectionsFromCardinalTemplate resolves east to different edge_index by rotation', () => {
    const pad0 = {
      ...pad('p0', 37.6, 55.75),
      properties: { pad_length_m: 120, pad_width_m: 80, pad_rotation_deg: 0 },
    };
    const bkns = {
      id: 'bkns',
      subtype: 'ground_pumping_station',
      lon: 37.3847751186604,
      lat: 55.83597526020202,
      properties: { pad_length_m: 120, pad_width_m: 80, pad_rotation_deg: 180 },
    } as InfraObject;
    const template = { oil_pipeline: { cardinal: 'east' as const, t: 0.5 } };
    const ring0 = resolveFootprintLonLat(pad0)!;
    const ring180 = resolveFootprintLonLat(bkns)!;
    const c0 = connectionsFromCardinalTemplate(ring0, template);
    const c180 = connectionsFromCardinalTemplate(ring180, template);
    expect(c0.oil_pipeline!.edge_index).not.toBe(c180.oil_pipeline!.edge_index);
    const pt0 = lonLatOnFootprintEdge(ring0, c0.oil_pipeline!.edge_index, 0.5)!;
    const pt180 = lonLatOnFootprintEdge(ring180, c180.oil_pipeline!.edge_index, 0.5)!;
    expect(pt0[0]).toBeGreaterThan(pad0.lon);
    expect(pt180[0]).toBeGreaterThan(bkns.lon);
  });

  it('applyFootprintTemplateToObject merge keeps other line types', () => {
    const p = {
      ...pad('p1', 37.6, 55.75),
      properties: {
        pad_length_m: 120,
        pad_width_m: 80,
        footprint_line_connections: { gas_pipeline: { edge_index: 2, t: 0.3 } },
      },
    } as InfraObject;
    const next = applyFootprintTemplateToObject(
      p,
      { oil_pipeline: { cardinal: 'south', t: 0.5 } },
      'merge',
    );
    expect(next?.gas_pipeline).toEqual({ edge_index: 2, t: 0.3 });
    expect(next?.oil_pipeline).toBeDefined();
  });

  it('applyFootprintTemplateToObject merge null removes line subtype', () => {
    const p = {
      ...pad('p1', 37.6, 55.75),
      properties: {
        pad_length_m: 120,
        pad_width_m: 80,
        footprint_line_connections: { oil_pipeline: { edge_index: 0, t: 0.5 } },
      },
    } as InfraObject;
    const next = applyFootprintTemplateToObject(p, { oil_pipeline: null }, 'merge');
    expect(next?.oil_pipeline).toBeUndefined();
  });

  it('applyFootprintTemplateToObject replace drops unstated line types', () => {
    const p = {
      ...pad('p1', 37.6, 55.75),
      properties: {
        pad_length_m: 120,
        pad_width_m: 80,
        footprint_line_connections: {
          oil_pipeline: { edge_index: 0 },
          gas_pipeline: { edge_index: 1 },
        },
      },
    } as InfraObject;
    const next = applyFootprintTemplateToObject(
      p,
      { oil_pipeline: { cardinal: 'east' } },
      'replace',
    );
    expect(next?.oil_pipeline).toBeDefined();
    expect(next?.gas_pipeline).toBeUndefined();
  });

  it('cardinal select helpers round-trip on rectangular pad', () => {
    const p = pad('p1', 37.6, 55.75);
    const ring = resolveFootprintLonLat(p)!;
    const attach = footprintAttachFromCardinalSelect(ring, 'east', 0.4)!;
    expect(footprintAttachCardinalSelectValue(ring, attach)).toBe('east');
    expect(footprintAttachCardinalSelectValue(ring, undefined)).toBe('__center__');
    expect(cardinalDirectionFromEdgeIndex(ring, attach.edge_index)).toBe('east');
  });
});
