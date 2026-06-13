import { describe, expect, it } from 'vitest';
import { footprintCornersLonLat, resolveFootprintLonLat } from './padFootprintGeo';
import {
  attachMarkerLocal,
  computeFootprintPickerViewBox,
  localEnuToLonLat,
  localRingEdgeCount,
  outwardOffsetFromEdgeMid,
  pickAttachOnLocalRing,
  pickAttachOnRing,
  pickFootprintPerimeterAttach,
  ringLonLatToLocalEnu,
} from './footprintPerimeterPickerGeo';
import { footprintRingEdges } from './padFootprintLineAttach';
import type { InfraObject } from './api';

const pad = (rotationDeg: number): InfraObject =>
  ({
    id: 'p1',
    subtype: 'oil_pad',
    lon: 37.6,
    lat: 55.75,
    properties: { pad_length_m: 120, pad_width_m: 80, pad_rotation_deg: rotationDeg },
  }) as InfraObject;

describe('footprintPerimeterPickerGeo', () => {
  it('roundtrips local ENU through anchor', () => {
    const ring = resolveFootprintLonLat(pad(0))!;
    const local = ringLonLatToLocalEnu(ring, pad(0).lon, pad(0).lat);
    const mid = local[1]!;
    const [lo, la] = localEnuToLonLat(mid.east_m, mid.north_m, pad(0).lon, pad(0).lat);
    expect(lo).toBeCloseTo(ring[1]![0], 9);
    expect(la).toBeCloseTo(ring[1]![1], 9);
  });

  it('computeFootprintPickerViewBox has positive size', () => {
    const ring = resolveFootprintLonLat(pad(0))!;
    const local = ringLonLatToLocalEnu(ring, pad(0).lon, pad(0).lat);
    const vb = computeFootprintPickerViewBox(local);
    expect(vb.width).toBeGreaterThan(0);
    expect(vb.height).toBeGreaterThan(0);
  });

  it('pickAttachOnRing returns edge on perimeter click', () => {
    const ring = resolveFootprintLonLat(pad(0))!;
    const marker = attachMarkerLocal(ring, pad(0).lon, pad(0).lat, 1, 0.5);
    expect(marker).not.toBeNull();
    const [lo, la] = localEnuToLonLat(marker!.east_m, marker!.north_m, pad(0).lon, pad(0).lat);
    const pick = pickAttachOnRing(ring, [lo, la]);
    expect(pick?.edge_index).toBe(1);
  });

  it('computeFootprintPickerViewBox is square and centered', () => {
    const ring = resolveFootprintLonLat(pad(0))!;
    const local = ringLonLatToLocalEnu(ring, pad(0).lon, pad(0).lat);
    const vb = computeFootprintPickerViewBox(local);
    expect(vb.width).toBe(vb.height);
    expect(vb.width).toBeGreaterThan(0);
  });

  it('pickAttachOnLocalRing selects geographic east side of default rectangle', () => {
    const ring = resolveFootprintLonLat(pad(0))!;
    const local = ringLonLatToLocalEnu(ring, pad(0).lon, pad(0).lat);
    const labels = footprintRingEdges(ring);
    const east = labels.find((e) => e.label.startsWith('Восток'));
    expect(east).toBeDefined();
    const eastMid = attachMarkerLocal(ring, pad(0).lon, pad(0).lat, east!.edgeIndex, 0.5)!;
    const pick = pickAttachOnLocalRing(local, eastMid, 20);
    expect(pick?.edge_index).toBe(east!.edgeIndex);
  });

  it('pickAttachOnLocalRing selects south from point south of footprint', () => {
    const ring = resolveFootprintLonLat(pad(0))!;
    const local = ringLonLatToLocalEnu(ring, pad(0).lon, pad(0).lat);
    const labels = footprintRingEdges(ring);
    const south = labels.find((e) => e.label.startsWith('Юг'))!;
    let minN = local[0]!.north_m;
    for (const p of local) minN = Math.min(minN, p.north_m);
    const vb = computeFootprintPickerViewBox(local);
    const pick = pickFootprintPerimeterAttach(
      local,
      { east_m: 0, north_m: minN - vb.width * 0.15 },
      vb.width,
    );
    expect(pick?.edge_index).toBe(south.edgeIndex);
  });

  it.each([0, 45, 90, 135, 180, 270])('all rectangle edges pickable at rotation %i°', (rotationDeg) => {
    const ring = footprintCornersLonLat(37.6, 55.75, 120, 80, rotationDeg);
    const closed = [...ring, ring[0]!];
    const local = ringLonLatToLocalEnu(closed, 37.6, 55.75);
    const vb = computeFootprintPickerViewBox(local);
    const edgeCount = localRingEdgeCount(local);
    for (let edgeIndex = 0; edgeIndex < edgeCount; edgeIndex += 1) {
      const click = outwardOffsetFromEdgeMid(local, edgeIndex, 0.5, vb.width * 0.06);
      expect(click).not.toBeNull();
      const pick = pickFootprintPerimeterAttach(local, click!, vb.width);
      expect(pick?.edge_index, `rotation ${rotationDeg} edge ${edgeIndex}`).toBe(edgeIndex);
    }
  });

  it.each([0, 45, 90, 135, 180])('pad params rotation picks every edge', (rotationDeg) => {
    const obj = pad(rotationDeg);
    const ring = resolveFootprintLonLat(obj)!;
    const local = ringLonLatToLocalEnu(ring, obj.lon, obj.lat);
    const vb = computeFootprintPickerViewBox(local);
    const edgeCount = localRingEdgeCount(local);
    for (let edgeIndex = 0; edgeIndex < edgeCount; edgeIndex += 1) {
      const click = outwardOffsetFromEdgeMid(local, edgeIndex, 0.5, vb.width * 0.06);
      expect(click).not.toBeNull();
      const pick = pickFootprintPerimeterAttach(local, click!, vb.width);
      expect(pick?.edge_index, `nds ${rotationDeg} edge ${edgeIndex}`).toBe(edgeIndex);
    }
  });

  it('BKNS rotation 180: cardinal east label matches max-east edge', () => {
    const obj = {
      id: 'c8a91c36-a477-4db6-a2c5-f5bb850fe572',
      subtype: 'ground_pumping_station',
      lon: 37.3847751186604,
      lat: 55.83597526020202,
      properties: { pad_length_m: 120, pad_width_m: 80, pad_rotation_deg: 180 },
    } as InfraObject;
    const ring = resolveFootprintLonLat(obj)!;
    const local = ringLonLatToLocalEnu(ring, obj.lon, obj.lat);
    const n = localRingEdgeCount(local);
    let maxE = -Infinity;
    let eastEdge = -1;
    for (let i = 0; i < n; i += 1) {
      const a = local[i]!;
      const b = local[(i + 1) % n]!;
      const midE = (a.east_m + b.east_m) / 2;
      if (midE > maxE) {
        maxE = midE;
        eastEdge = i;
      }
    }
    const eastLabel = footprintRingEdges(ring).find((e) => e.label.startsWith('Восток'));
    expect(eastLabel?.edgeIndex, footprintRingEdges(ring).map((e) => e.label).join(', ')).toBe(
      eastEdge,
    );
    expect(eastLabel?.edgeIndex).not.toBe(0);
  });
});
