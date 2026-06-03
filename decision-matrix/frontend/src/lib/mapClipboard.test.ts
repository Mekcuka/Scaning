import { describe, expect, it } from 'vitest';
import {
  applyOffsetToClipboard,
  buildClipboardFromSelection,
  clipboardCentroid,
  infraPasteSubtypePlan,
  partitionClipboardForPaste,
  remapLineEndpointsOnPaste,
  type MapClipboardItem,
} from './mapClipboard';
import type { InfraObject, POI } from './api';

const poi: POI = {
  id: 'poi-1',
  project_id: 'p1',
  name: 'POI A',
  lon: 37.6,
  lat: 55.75,
} as unknown as POI;

const pointInfra: InfraObject = {
  id: 'pt-1',
  project_id: 'p1',
  name: 'Node 1',
  subtype: 'node',
  lon: 37.61,
  lat: 55.751,
  layer_id: 'layer-1',
} as unknown as InfraObject;

const lineInfra: InfraObject = {
  id: 'line-1',
  project_id: 'p1',
  name: 'Road 1',
  subtype: 'autoroad',
  lon: 37.61,
  lat: 55.751,
  end_lon: 37.65,
  end_lat: 55.755,
  coordinates: [
    [37.61, 55.751],
    [37.65, 55.755],
  ],
  layer_id: 'layer-1',
} as unknown as InfraObject;

describe('mapClipboard', () => {
  it('buildClipboardFromSelection captures snapshots', () => {
    const items = buildClipboardFromSelection(
      [poi],
      [pointInfra, lineInfra],
      [
        { kind: 'poi', id: 'poi-1' },
        { kind: 'infra', id: 'line-1' },
      ],
    );
    expect(items).toHaveLength(2);
    expect(items[0]?.kind).toBe('poi');
    expect(items[1]?.kind === 'infra' && items[1].snapshot.subtype).toBe('autoroad');
  });

  it('applyOffsetToClipboard moves centroid to anchor', () => {
    const items = buildClipboardFromSelection([poi], [], [{ kind: 'poi', id: 'poi-1' }]);
    const shifted = applyOffsetToClipboard(items, 40, 50);
    expect(shifted[0]?.snapshot.lon).toBeCloseTo(40, 5);
    expect(shifted[0]?.snapshot.lat).toBeCloseTo(50, 5);
  });

  it('centroid averages point and line vertices', () => {
    const items = buildClipboardFromSelection(
      [],
      [lineInfra],
      [{ kind: 'infra', id: 'line-1' }],
    );
    const c = clipboardCentroid(items);
    expect(c.lon).toBeCloseTo((37.61 + 37.65) / 2, 5);
    expect(c.lat).toBeCloseTo((55.751 + 55.755) / 2, 5);
  });

  it('remapLineEndpointsOnPaste snaps line to new point pool', () => {
    const items = buildClipboardFromSelection(
      [],
      [pointInfra, lineInfra],
      [
        { kind: 'infra', id: 'pt-1' },
        { kind: 'infra', id: 'line-1' },
      ],
    );
    const offset = applyOffsetToClipboard(items, 38, 56);
    const { pointInfra: pts, lineInfra: lines } = partitionClipboardForPaste(offset);
    const createdPoint: InfraObject = {
      ...pointInfra,
      id: 'new-pt',
      lon: pts[0]!.snapshot.lon,
      lat: pts[0]!.snapshot.lat,
    };
    const lineItem = lines[0]!;
    if (lineItem.kind !== 'infra') throw new Error('expected infra line');
    const lineSnap = lineItem.snapshot;
    const remapped = remapLineEndpointsOnPaste(lineSnap, [createdPoint]);
    expect(remapped.lon).toBeCloseTo(createdPoint.lon, 6);
    expect(remapped.lat).toBeCloseTo(createdPoint.lat, 6);
  });

  it('infraPasteSubtypePlan maps gas_pad to oil_pad then patch', () => {
    expect(infraPasteSubtypePlan('oil_pad')).toEqual({
      createSubtype: 'oil_pad',
      targetSubtype: 'oil_pad',
    });
    expect(infraPasteSubtypePlan('gas_pad')).toEqual({
      createSubtype: 'oil_pad',
      targetSubtype: 'gas_pad',
    });
  });

  it('partitionClipboardForPaste splits kinds', () => {
    const items: MapClipboardItem[] = [
      { kind: 'poi', sourceId: 'p', snapshot: { lon: 0, lat: 0, name: 'a' } },
      {
        kind: 'infra',
        sourceId: 'n',
        snapshot: {
          lon: 1,
          lat: 1,
          name: 'n',
          subtype: 'node',
          layer_id: 'l',
        },
      },
      {
        kind: 'infra',
        sourceId: 'l',
        snapshot: {
          lon: 1,
          lat: 1,
          end_lon: 2,
          end_lat: 2,
          name: 'line',
          subtype: 'autoroad',
          layer_id: 'l',
          coordinates: [
            [1, 1],
            [2, 2],
          ],
        },
      },
    ];
    const parts = partitionClipboardForPaste(items);
    expect(parts.pois).toHaveLength(1);
    expect(parts.pointInfra).toHaveLength(1);
    expect(parts.lineInfra).toHaveLength(1);
  });
});
