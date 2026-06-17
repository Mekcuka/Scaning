import { describe, expect, it } from 'vitest';
import {
  applyOffsetToClipboard,
  buildClipboardFromSelection,
  buildMapBatchPasteRequest,
  BATCH_PASTE_CHUNK_SIZE,
  batchPasteTimeoutMs,
  clipboardCentroid,
  clipboardPreviewAt,
  executeMapBatchPaste,
  infraPasteSubtypePlan,
  partitionClipboardForPaste,
  remapLineEndpointsForPaste,
  sanitizeInfraCreateForApi,
  sanitizePoiCreateForApi,
  type MapClipboardItem,
} from './mapClipboard';
import { remapBottomholePasteRefs } from './mapBatchPaste';
import { WELL_BOTTOMHOLE_LINKED_PAD_ID } from '../wellBottomholeProperties';
import { lineLengthMeters } from './mapMeasure';
import type { InfraObject, POI } from '../api';

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
    [37.63, 55.753],
    [37.65, 55.755],
  ],
  layer_id: 'layer-1',
} as unknown as InfraObject;

describe('mapClipboard', () => {
  it('clipboardPreviewAt uses lon/end_lon when coordinates are stale for GS bottomhole', () => {
    const gsBottomhole: InfraObject = {
      id: 'bh-gs-stale',
      project_id: 'p1',
      name: 'GS-stale',
      subtype: 'well_bottomhole_gs',
      lon: 38.0,
      lat: 56.0,
      end_lon: 38.5,
      end_lat: 56.5,
      coordinates: [
        [37.0, 55.0],
        [37.1, 55.0],
      ],
      layer_id: 'layer-1',
    } as unknown as InfraObject;
    const items = buildClipboardFromSelection([], [gsBottomhole], [
      { kind: 'infra', id: gsBottomhole.id },
    ]);
    const preview = clipboardPreviewAt(items, 40, 50);
    const line = preview.lines[0]?.coordinates;
    expect(line?.[0]).toEqual([39.75, 49.75]);
    expect(line?.[1]).toEqual([40.25, 50.25]);
  });

  it('buildMapBatchPasteRequest uses canonical GS endpoints for stale coordinates', () => {
    const gsBottomhole: InfraObject = {
      id: 'bh-gs-stale',
      project_id: 'p1',
      name: 'GS-stale',
      subtype: 'well_bottomhole_gs',
      lon: 38.0,
      lat: 56.0,
      end_lon: 38.5,
      end_lat: 56.5,
      coordinates: [
        [37.0, 55.0],
        [37.1, 55.0],
      ],
      layer_id: 'layer-1',
    } as unknown as InfraObject;
    const items = buildClipboardFromSelection([], [gsBottomhole], [
      { kind: 'infra', id: gsBottomhole.id },
    ]);
    const offset = applyOffsetToClipboard(items, 40, 50);
    const req = buildMapBatchPasteRequest(offset, {
      existingPois: [],
      nextPoiAutoName: () => 'POI_1',
      nextAutoName: () => 'GS_1',
      mergeProperties: (_st, props) => props,
    });
    expect(req.infra_lines).toHaveLength(1);
    const create = req.infra_lines[0]!.create;
    expect(create.lon).toBe(39.75);
    expect(create.end_lon).toBe(40.25);
    expect(create.coordinates).toEqual([
      [39.75, 49.75],
      [40.25, 50.25],
    ]);
  });

  it('clipboardPreviewAt includes GS bottomhole line and heel/toe markers', () => {
    const gsBottomhole: InfraObject = {
      id: 'bh-gs-1',
      project_id: 'p1',
      name: 'GS-1',
      subtype: 'well_bottomhole_gs',
      lon: 37.61,
      lat: 55.751,
      end_lon: 37.65,
      end_lat: 55.755,
      layer_id: 'layer-1',
    } as unknown as InfraObject;
    const items = buildClipboardFromSelection([], [gsBottomhole], [{ kind: 'infra', id: gsBottomhole.id }]);
    const preview = clipboardPreviewAt(items, 38, 56);
    expect(preview.lines).toHaveLength(1);
    expect(preview.lines[0]?.subtype).toBe('well_bottomhole_gs');
    expect(preview.lines[0]?.coordinates).toHaveLength(2);
    expect(preview.points.map((p) => p.subtype)).toEqual([
      'well_bottomhole_gs_heel',
      'well_bottomhole_gs_toe',
    ]);
    expect(preview.lines[0]?.coordinates[0]).toEqual([
      preview.points[0]!.lon,
      preview.points[0]!.lat,
    ]);
  });

  it('clipboardPreviewAt includes NNB bottomhole point', () => {
    const nnb: InfraObject = {
      id: 'bh-nnb-1',
      project_id: 'p1',
      name: 'NNB-1',
      subtype: 'well_bottomhole_nnb',
      lon: 37.61,
      lat: 55.751,
      layer_id: 'layer-1',
    } as unknown as InfraObject;
    const items = buildClipboardFromSelection([], [nnb], [{ kind: 'infra', id: nnb.id }]);
    const preview = clipboardPreviewAt(items, 38, 56);
    expect(preview.lines).toHaveLength(0);
    expect(preview.points).toEqual([
      expect.objectContaining({ subtype: 'well_bottomhole_nnb', lon: expect.any(Number), lat: expect.any(Number) }),
    ]);
  });

  it('buildClipboardFromSelection captures snapshots', () => {
    const items = buildClipboardFromSelection(
      [poi],
      [pointInfra, lineInfra],
      [
        { kind: 'poi', id: 'poi-1' },
        { kind: 'infra', id: 'line-1' },
      ],
    );
    expect(items).toHaveLength(3);
    expect(items[0]?.kind).toBe('poi');
    const lineItem = items.find((i) => i.kind === 'infra' && i.snapshot.subtype === 'autoroad');
    expect(lineItem?.kind).toBe('infra');
  });

  it('buildClipboardFromSelection auto-includes line endpoint nodes not in selection', () => {
    const externalNode: InfraObject = {
      ...pointInfra,
      id: 'pt-external',
      lon: 37.65,
      lat: 55.755,
    };
    const items = buildClipboardFromSelection(
      [],
      [pointInfra, externalNode, lineInfra],
      [{ kind: 'infra', id: 'line-1' }],
    );
    expect(items).toHaveLength(3);
    const lineItem = items.find((i) => i.kind === 'infra' && i.snapshot.subtype === 'autoroad');
    expect(lineItem?.kind).toBe('infra');
    if (lineItem?.kind !== 'infra') throw new Error('expected line');
    expect(lineItem.endpointAttach?.startSourceId).toBe('pt-1');
    expect(lineItem.endpointAttach?.finishSourceId).toBe('pt-external');
    expect(items.some((i) => i.kind === 'infra' && i.sourceId === 'pt-1')).toBe(true);
    expect(items.some((i) => i.kind === 'infra' && i.sourceId === 'pt-external')).toBe(true);
  });

  it('buildMapBatchPasteRequest auto-includes endpoint nodes when only line is selected', () => {
    const nodeA: InfraObject = { ...pointInfra, id: 'n-a', lon: 37.61, lat: 55.751 };
    const nodeB: InfraObject = {
      ...pointInfra,
      id: 'n-b',
      lon: 37.65,
      lat: 55.755,
    };
    const line: InfraObject = {
      ...lineInfra,
      id: 'line-ab',
      coordinates: [
        [37.61, 55.751],
        [37.65, 55.755],
      ],
    };
    const items = buildClipboardFromSelection([], [nodeA, nodeB, line], [
      { kind: 'infra', id: 'line-ab' },
    ]);
    const offset = applyOffsetToClipboard(items, 38, 56);
    const req = buildMapBatchPasteRequest(offset, {
      existingPois: [],
      nextPoiAutoName: () => 'POI_1',
      nextAutoName: (st) => `name_${st}`,
      mergeProperties: (_st, props) => props,
    });
    expect(req.infra_points).toHaveLength(2);
    expect(req.infra_lines).toHaveLength(1);
    expect(req.infra_lines[0]?.snap_start_ref).toBe('n-a');
    expect(req.infra_lines[0]?.snap_finish_ref).toBe('n-b');
  });

  it('buildClipboardFromSelection records endpointAttach for line ends in selection', () => {
    const items = buildClipboardFromSelection(
      [],
      [pointInfra, lineInfra],
      [
        { kind: 'infra', id: 'pt-1' },
        { kind: 'infra', id: 'line-1' },
      ],
    );
    const lineItem = items.find((i) => i.kind === 'infra' && i.snapshot.subtype === 'autoroad');
    expect(lineItem?.kind).toBe('infra');
    if (lineItem?.kind !== 'infra') throw new Error('expected line');
    expect(lineItem.endpointAttach?.startSourceId).toBe('pt-1');
    expect(lineItem.endpointAttach?.finishSourceId).toBeUndefined();
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
    expect(c.lon).toBeCloseTo((37.61 + 37.63 + 37.65) / 3, 5);
    expect(c.lat).toBeCloseTo((55.751 + 55.753 + 55.755) / 3, 5);
  });

  it('remapLineEndpointsForPaste binds start to twin by sourceId', () => {
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
    const idMap = new Map<string, InfraObject>([['pt-1', createdPoint]]);
    const { snap, line_snap_start_object_id } = remapLineEndpointsForPaste(
      lineItem.snapshot,
      lineItem.endpointAttach,
      idMap,
    );
    expect(line_snap_start_object_id).toBe('new-pt');
    expect(snap.coordinates).toEqual(lineItem.snapshot.coordinates);
    expect(snap.lon).toBe(lineItem.snapshot.lon);
  });

  it('paste at two anchors yields equal line length when group includes node', () => {
    const items = buildClipboardFromSelection(
      [],
      [pointInfra, lineInfra],
      [
        { kind: 'infra', id: 'pt-1' },
        { kind: 'infra', id: 'line-1' },
      ],
    );

    const pasteAt = (anchorLon: number, anchorLat: number) => {
      const offset = applyOffsetToClipboard(items, anchorLon, anchorLat);
      const { pointInfra: pts, lineInfra: lines } = partitionClipboardForPaste(offset);
      const createdPoint: InfraObject = {
        ...pointInfra,
        id: `pt-${anchorLon}`,
        lon: pts[0]!.snapshot.lon,
        lat: pts[0]!.snapshot.lat,
      };
      const lineItem = lines[0]!;
      if (lineItem.kind !== 'infra') throw new Error('expected line');
      const idMap = new Map([['pt-1', createdPoint]]);
      const { snap } = remapLineEndpointsForPaste(
        lineItem.snapshot,
        lineItem.endpointAttach,
        idMap,
      );
      return lineLengthMeters(snap.coordinates!);
    };

    const lenA = pasteAt(37.62, 55.76);
    const lenB = pasteAt(37.64, 55.74);
    expect(Math.abs(lenA - lenB)).toBeLessThan(2);
  });

  it('infraPasteSubtypePlan maps gas_pad to oil_pad then patch', () => {
    expect(infraPasteSubtypePlan('oil_pad')).toEqual({
      createSubtype: 'oil_pad',
      targetSubtype: 'oil_pad',
      useFacilityEndpoint: false,
    });
    expect(infraPasteSubtypePlan('gas_pad')).toEqual({
      createSubtype: 'oil_pad',
      targetSubtype: 'gas_pad',
      useFacilityEndpoint: false,
    });
  });

  it('infraPasteSubtypePlan creates methanol_facility via POST /objects', () => {
    expect(infraPasteSubtypePlan('methanol_facility')).toEqual({
      createSubtype: 'methanol_facility',
      targetSubtype: 'methanol_facility',
      useFacilityEndpoint: false,
    });
  });

  it('infraPasteSubtypePlan routes НПЗ/НПС through facility-objects', () => {
    expect(infraPasteSubtypePlan('refinery')).toEqual({
      createSubtype: 'refinery',
      targetSubtype: 'refinery',
      useFacilityEndpoint: true,
    });
    expect(infraPasteSubtypePlan('oil_pumping_station')).toEqual({
      createSubtype: 'oil_pumping_station',
      targetSubtype: 'oil_pumping_station',
      useFacilityEndpoint: true,
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

  it('buildMapBatchPasteRequest sorts pad before linked bottomholes', () => {
    const padId = 'pad-old-id';
    const well: InfraObject = {
      ...pointInfra,
      id: 'well-1',
      subtype: 'well_bottomhole_nnb',
      name: 'Забой_1',
      properties: {
        [WELL_BOTTOMHOLE_LINKED_PAD_ID]: padId,
        well_bottomhole_tvd_m: 1500,
      },
    };
    const pad: InfraObject = {
      ...pointInfra,
      id: padId,
      subtype: 'oil_pad',
      name: 'Куст_1',
    };
    const items = buildClipboardFromSelection(
      [],
      [well, pad],
      [
        { kind: 'infra', id: well.id },
        { kind: 'infra', id: pad.id },
      ],
    );
    const req = buildMapBatchPasteRequest(applyOffsetToClipboard(items, 38, 56), {
      existingPois: [],
      nextPoiAutoName: () => 'POI_1',
      nextAutoName: () => 'name',
      mergeProperties: (_st, props) => props,
    });
    expect(req.infra_points).toHaveLength(2);
    expect(req.infra_points[0]?.client_ref).toBe(padId);
    expect(req.infra_points[1]?.create.properties?.[WELL_BOTTOMHOLE_LINKED_PAD_ID]).toBe(padId);
  });

  it('remapBottomholePasteRefs maps parent/heel via batch twins and pad via padRefToCreated', () => {
    const mapped = remapBottomholePasteRefs(
      { [WELL_BOTTOMHOLE_LINKED_PAD_ID]: 'old-pad', well_bottomhole_parent_id: 'old-main' },
      new Map([['old-main', 'new-main-id']]),
      new Map([['old-pad', 'new-pad-id']]),
    );
    expect(mapped?.[WELL_BOTTOMHOLE_LINKED_PAD_ID]).toBe('new-pad-id');
    expect(mapped?.well_bottomhole_parent_id).toBe('new-main-id');
  });

  it('remapBottomholePasteRefs does not map linked_pad_id from well batch twins', () => {
    const mapped = remapBottomholePasteRefs(
      { [WELL_BOTTOMHOLE_LINKED_PAD_ID]: 'old-pad' },
      new Map([['old-pad', 'well-id-by-mistake']]),
    );
    expect(mapped?.[WELL_BOTTOMHOLE_LINKED_PAD_ID]).toBe('old-pad');
  });

  it('buildMapBatchPasteRequest strips linked_pad_id when pad is not in selection', () => {
    const padId = 'pad-not-pasted';
    const well: InfraObject = {
      ...pointInfra,
      id: 'well-1',
      subtype: 'well_bottomhole_nnb',
      name: 'Забой_1',
      properties: {
        [WELL_BOTTOMHOLE_LINKED_PAD_ID]: padId,
        well_bottomhole_tvd_m: 1500,
      },
    };
    const items = buildClipboardFromSelection(
      [],
      [well],
      [{ kind: 'infra', id: well.id }],
    );
    const req = buildMapBatchPasteRequest(applyOffsetToClipboard(items, 38, 56), {
      existingPois: [],
      nextPoiAutoName: () => 'POI_1',
      nextAutoName: () => 'name',
      mergeProperties: (_st, props) => props,
    });
    expect(req.infra_points).toHaveLength(1);
    expect(req.infra_points[0]?.create.properties?.[WELL_BOTTOMHOLE_LINKED_PAD_ID]).toBeUndefined();
  });

  it('buildMapBatchPasteRequest strips linked_pad_id from GS line when pad is not in selection', () => {
    const padId = 'pad-not-pasted';
    const gsBottomhole: InfraObject = {
      id: 'bh-gs-1',
      project_id: 'p1',
      name: 'GS-1',
      subtype: 'well_bottomhole_gs',
      lon: 37.61,
      lat: 55.751,
      end_lon: 37.65,
      end_lat: 55.755,
      coordinates: [
        [37.61, 55.751],
        [37.65, 55.755],
      ],
      layer_id: 'layer-1',
      properties: {
        [WELL_BOTTOMHOLE_LINKED_PAD_ID]: padId,
        well_bottomhole_heel_tvd_m: 1500,
        well_bottomhole_toe_tvd_m: 1500,
      },
    } as unknown as InfraObject;
    const items = buildClipboardFromSelection([], [gsBottomhole], [
      { kind: 'infra', id: gsBottomhole.id },
    ]);
    const req = buildMapBatchPasteRequest(applyOffsetToClipboard(items, 38, 56), {
      existingPois: [],
      nextPoiAutoName: () => 'POI_1',
      nextAutoName: () => 'GS_1',
      mergeProperties: (_st, props) => props,
    });
    expect(req.infra_lines).toHaveLength(1);
    expect(req.infra_lines[0]?.create.properties?.[WELL_BOTTOMHOLE_LINKED_PAD_ID]).toBeUndefined();
  });

  it('buildMapBatchPasteRequest maps gas_pad to oil_pad create + target_subtype', () => {
    const gasPad: InfraObject = {
      ...pointInfra,
      id: 'pad-gas',
      subtype: 'gas_pad',
      name: 'Gas pad',
    };
    const items = buildClipboardFromSelection([], [gasPad], [{ kind: 'infra', id: gasPad.id }]);
    const offset = applyOffsetToClipboard(items, 38, 56);
    const req = buildMapBatchPasteRequest(offset, {
      existingPois: [],
      nextPoiAutoName: () => 'POI_1',
      nextAutoName: () => 'Куст_1',
      mergeProperties: (_st, props) => props,
    });
    expect(req.infra_points).toHaveLength(1);
    expect(req.infra_points[0]?.create.subtype).toBe('oil_pad');
    expect(req.infra_points[0]?.target_subtype).toBe('gas_pad');
    expect(req.infra_points[0]?.client_ref).toBe('pad-gas');
  });

  it('buildMapBatchPasteRequest passes line snap refs from endpointAttach', () => {
    const nodeA: InfraObject = { ...pointInfra, id: 'n-a', lon: 37.61, lat: 55.751 };
    const nodeB: InfraObject = {
      ...pointInfra,
      id: 'n-b',
      lon: 37.65,
      lat: 55.755,
    };
    const line: InfraObject = {
      ...lineInfra,
      id: 'line-ab',
      lon: 37.61,
      lat: 55.751,
      end_lon: 37.65,
      end_lat: 55.755,
      coordinates: [
        [37.61, 55.751],
        [37.65, 55.755],
      ],
    };
    const items = buildClipboardFromSelection(
      [],
      [nodeA, nodeB, line],
      [
        { kind: 'infra', id: 'n-a' },
        { kind: 'infra', id: 'n-b' },
        { kind: 'infra', id: 'line-ab' },
      ],
    );
    const offset = applyOffsetToClipboard(items, 38, 56);
    const req = buildMapBatchPasteRequest(offset, {
      existingPois: [],
      nextPoiAutoName: () => 'POI_1',
      nextAutoName: (st) => `name_${st}`,
      mergeProperties: (_st, props) => props,
    });
    expect(req.infra_lines).toHaveLength(1);
    expect(req.infra_lines[0]?.snap_start_ref).toBe('n-a');
    expect(req.infra_lines[0]?.snap_finish_ref).toBe('n-b');
    expect(req.infra_lines[0]?.create.line_preserve_geometry).toBe(true);
  });

  it('sanitizeInfraCreateForApi drops null properties and read-only fields', () => {
    const cleaned = sanitizeInfraCreateForApi({
      id: 'x',
      category: 'road',
      render_3d_effective: { height_m: 1, base_m: 0, visible: true, scale: 1 },
      name: 'L',
      subtype: 'autoroad',
      lon: 1,
      lat: 2,
      properties: null as unknown as Record<string, unknown>,
    } as InfraObject);
    expect(cleaned).toEqual({
      name: 'L',
      subtype: 'autoroad',
      lon: 1,
      lat: 2,
    });
  });

  it('sanitizePoiCreateForApi keeps only POICreate fields', () => {
    const cleaned = sanitizePoiCreateForApi({
      id: 'poi-1',
      project_id: 'p1',
      pads_count: 2,
      name: 'POI',
      lon: 37.6,
      lat: 55.75,
      threshold_gas_processing_km: 80,
    } as POI);
    expect(cleaned).toEqual({
      name: 'POI',
      description: null,
      lon: 37.6,
      lat: 55.75,
      planned_production_volume: 0,
      production_per_well: 10,
      wells_per_pad: 4,
      fluid_type: 'oil',
      water_injection_volume: 0,
      gas_factor: 120,
      eng_power: 'external',
      eng_injection: 'centralized',
      eng_gas: 'well',
      eng_oil_preparation: 'mkos',
      eng_well_gathering: 'single_tube',
      eng_transport: 'auto',
    });
  });

  it('batchPasteTimeoutMs scales with payload size', () => {
    const small = buildMapBatchPasteRequest(
      [{ kind: 'poi', sourceId: 'p1', snapshot: { ...poi, id: 'p1' } }],
      {
        existingPois: [],
        nextPoiAutoName: () => 'POI_2',
        nextAutoName: () => 'node_1',
        mergeProperties: (_st, props) => props ?? {},
      },
    );
    expect(batchPasteTimeoutMs(small)).toBe(120_000);

    const large = buildMapBatchPasteRequest(
      Array.from({ length: 800 }, (_, i) => ({
        kind: 'infra' as const,
        sourceId: `pt-${i}`,
        snapshot: { ...pointInfra, id: `pt-${i}`, name: `N_${i}` },
      })),
      {
        existingPois: [],
        nextPoiAutoName: () => 'POI_1',
        nextAutoName: (st) => `${st}_1`,
        mergeProperties: (_st, props) => props ?? {},
      },
    );
    expect(batchPasteTimeoutMs(large)).toBe(120_000);
  });

  it('executeMapBatchPaste reports progress for single and multi-chunk payloads', async () => {
    const progress: import('./mapClipboard').MapPasteProgressUpdate[] = [];
    const smallPayload = buildMapBatchPasteRequest(
      [{ kind: 'poi', sourceId: 'p1', snapshot: { ...poi, id: 'p1' } }],
      {
        existingPois: [],
        nextPoiAutoName: () => 'POI_2',
        nextAutoName: () => 'node_1',
        mergeProperties: (_st, props) => props ?? {},
      },
    );

    await executeMapBatchPaste('p1', smallPayload, async () => ({
      created_pois: [{ ...poi, id: 'new-poi', name: 'POI_2' }],
      created_infra: [],
      network_rebuilt: false,
    }), (update) => progress.push({ ...update }));

    expect(progress).toHaveLength(2);
    expect(progress[0]?.indeterminate).toBe(true);
    expect(progress[0]?.done).toBe(0);
    expect(progress[1]?.done).toBe(1);

    progress.length = 0;
    const pointCount = BATCH_PASTE_CHUNK_SIZE + 50;
    const largePayload = buildMapBatchPasteRequest(
      Array.from({ length: pointCount }, (_, i) => ({
        kind: 'infra' as const,
        sourceId: `pt-${i}`,
        snapshot: { ...pointInfra, id: `pt-${i}`, name: `N_${i}` },
      })),
      {
        existingPois: [],
        nextPoiAutoName: () => 'POI_1',
        nextAutoName: (st) => `${st}_1`,
        mergeProperties: (_st, props) => props ?? {},
      },
    );

    await executeMapBatchPaste('p1', largePayload, async (_pid, chunk) => ({
      created_pois: [],
      created_infra: chunk.infra_points.map((item) => ({
        id: `created-${item.client_ref}`,
        name: item.create.name,
        subtype: item.create.subtype,
        lon: item.create.lon,
        lat: item.create.lat,
        layer_id: item.create.layer_id ?? 'layer-1',
      })),
      network_rebuilt: false,
    }), (update) => progress.push({ ...update }));

    expect(progress.length).toBeGreaterThan(2);
    expect(progress.some((p) => p.indeterminate === false && p.done > 0)).toBe(true);
    expect(progress.at(-1)?.done).toBe(pointCount);
  });

  it('executeMapBatchPaste splits oversized payloads and remaps line snap refs', async () => {
    const calls: Array<{ pois: number; points: number; lines: number }> = [];
    const pointCount = BATCH_PASTE_CHUNK_SIZE + 50;
    const payload = buildMapBatchPasteRequest(
      [
        {
          kind: 'infra',
          sourceId: 'pt-start',
          snapshot: { ...pointInfra, id: 'pt-start', name: 'Start' },
        },
        {
          kind: 'infra',
          sourceId: 'pt-finish',
          snapshot: { ...pointInfra, id: 'pt-finish', name: 'Finish', lon: 37.62, lat: 55.752 },
        },
        {
          kind: 'infra',
          sourceId: 'line-1',
          snapshot: lineInfra,
          endpointAttach: { startSourceId: 'pt-start', finishSourceId: 'pt-finish' },
        },
        ...Array.from({ length: pointCount - 2 }, (_, i) => ({
          kind: 'infra' as const,
          sourceId: `pt-extra-${i}`,
          snapshot: {
            ...pointInfra,
            id: `pt-extra-${i}`,
            name: `Extra_${i}`,
            lon: 37.6 + i * 0.00001,
          },
        })),
      ],
      {
        existingPois: [],
        nextPoiAutoName: () => 'POI_1',
        nextAutoName: (st) => `${st}_1`,
        mergeProperties: (_st, props) => props ?? {},
      },
    );

    const result = await executeMapBatchPaste('project-1', payload, async (_pid, chunk) => {
      calls.push({
        pois: chunk.pois.length,
        points: chunk.infra_points.length,
        lines: chunk.infra_lines.length,
      });
      const createdPoints = chunk.infra_points.map((item) => ({
        id: `created-${item.client_ref}`,
        name: item.create.name,
        subtype: item.create.subtype,
        lon: item.create.lon,
        lat: item.create.lat,
        layer_id: item.create.layer_id ?? 'layer-1',
      }));
      const createdLines = chunk.infra_lines.map((item) => ({
        id: `created-${item.client_ref}`,
        name: item.create.name,
        subtype: item.create.subtype,
        lon: item.create.lon,
        lat: item.create.lat,
        layer_id: item.create.layer_id ?? 'layer-1',
      }));
      return {
        created_pois: [],
        created_infra: [...createdPoints, ...createdLines],
        network_rebuilt: chunk.infra_lines.length > 0,
      };
    });

    expect(calls.length).toBeGreaterThan(1);
    expect(calls.some((c) => c.lines > 0)).toBe(true);
    expect(result.created_infra.length).toBe(pointCount + 1);
    const lineCall = calls.find((c) => c.lines > 0);
    expect(lineCall).toBeTruthy();
  });
});
