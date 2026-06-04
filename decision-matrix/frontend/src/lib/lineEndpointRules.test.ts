import { describe, expect, it } from 'vitest';
import type { InfraObject } from './api';
import {
  constrainLineCoordinatesOnEdit,
  findLineEndpointAttachment,
  isLineEndpointSnapped,
  lineEndpointAttachmentsFromObject,
  normalizeLinePathEndpoints,
  resolveLineEndpoint,
  snapLineDrawPoint,
} from './lineEndpointRules';

const pointObj = (id: string, subtype: string, lon: number, lat: number): InfraObject =>
  ({
    id,
    name: `obj_${id}`,
    subtype,
    category: 'point',
    lon,
    lat,
    layer_id: 'layer-1',
    project_id: 'p1',
    properties: {},
  }) as InfraObject;

describe('snapLineDrawPoint', () => {
  it('snaps to point under cursor when drawing', () => {
    const objects = [pointObj('1', 'oil_pad', 37.6, 55.75)];
    const snapped = snapLineDrawPoint(
      'autoroad',
      [38, 56],
      objects,
      { lon: 37.6, lat: 55.75, id: '1' },
    );
    expect(snapped).toEqual([37.6, 55.75]);
  });

  it('does not snap by distance when no cursor hit', () => {
    const objects = [pointObj('1', 'gas_processing', 37.6, 55.75)];
    const snapped = snapLineDrawPoint('autoroad', [37.61, 55.76], objects);
    expect(snapped).toEqual([37.61, 55.76]);
  });
});

describe('resolveLineEndpoint', () => {
  it('plans node creation for line finish in empty space', () => {
    const objects = [pointObj('1', 'gas_processing', 37.6, 55.75)];
    const resolved = resolveLineEndpoint('autoroad', 'finish', [38.0, 56.0], objects);
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.createNode).toBe(true);
      expect(resolved.lon).toBe(38.0);
      expect(resolved.lat).toBe(56.0);
    }
  });

  it('rejects start away from any point object', () => {
    const objects = [pointObj('1', 'oil_pad', 37.6, 55.75)];
    const resolved = resolveLineEndpoint('oil_pipeline', 'start', [37.61, 55.76], objects);
    expect(resolved.ok).toBe(false);
  });

  it('attaches finish when coords match point exactly', () => {
    const pad = pointObj('1', 'oil_pad', 37.6, 55.75);
    const resolved = resolveLineEndpoint('power_line', 'finish', [37.6, 55.75], [pad]);
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.createNode).toBe(false);
      expect(resolved.lon).toBe(37.6);
      expect(resolved.lat).toBe(55.75);
    }
  });
});

describe('isLineEndpointSnapped', () => {
  it('is true only for exact coords', () => {
    const pad = pointObj('1', 'oil_pad', 37.6, 55.75);
    expect(isLineEndpointSnapped('oil_pipeline', 'start', [37.6, 55.75], [pad])).toBe(true);
    expect(isLineEndpointSnapped('oil_pipeline', 'start', [37.61, 55.76], [pad])).toBe(false);
  });
});

describe('normalizeLinePathEndpoints', () => {
  it('aligns ends only when coords match a point object', () => {
    const pad = pointObj('pad', 'oil_pad', 37.6, 55.75);
    const path = normalizeLinePathEndpoints(
      'oil_pipeline',
      [
        [37.6, 55.75],
        [37.65, 55.8],
        [37.7001, 55.8501],
      ],
      [pad],
    );
    expect(path[0]).toEqual([37.6, 55.75]);
    expect(path[2]).toEqual([37.7001, 55.8501]);
  });

  it('does not pull ends within 300 m without exact match', () => {
    const pad = pointObj('pad', 'oil_pad', 37.6, 55.75);
    const path = normalizeLinePathEndpoints(
      'oil_pipeline',
      [
        [37.61, 55.76],
        [37.65, 55.8],
        [37.7001, 55.8501],
      ],
      [pad],
    );
    expect(path[0]).toEqual([37.61, 55.76]);
  });
});

describe('lineEndpointAttachmentsFromObject', () => {
  it('finds attachments via snapPool when node is not in infraObjects', () => {
    const pad = pointObj('pad-1', 'oil_pad', 37.6, 55.75);
    const node = pointObj('node-1', 'node', 37.7, 55.85);
    const lineObj = {
      id: 'line-1',
      name: 'line',
      subtype: 'oil_pipeline',
      category: 'line',
      lon: 37.6,
      lat: 55.75,
      end_lon: 37.7,
      end_lat: 55.85,
      coordinates: [
        [37.6, 55.75],
        [37.65, 55.8],
        [37.7, 55.85],
      ],
      layer_id: 'layer-1',
      project_id: 'p1',
      properties: {},
    } as InfraObject;
    const endpoints = lineEndpointAttachmentsFromObject(lineObj, [], [pad, node]);
    expect(endpoints?.startAttach?.object.id).toBe('pad-1');
    expect(endpoints?.finishAttach?.object.id).toBe('node-1');
  });
});

describe('findLineEndpointAttachment', () => {
  it('returns attachment only for exact endpoint coords', () => {
    const pad = pointObj('pad', 'oil_pad', 37.6, 55.75);
    expect(findLineEndpointAttachment('oil_pipeline', 'start', [37.6, 55.75], [pad])?.object.id).toBe(
      'pad',
    );
    expect(findLineEndpointAttachment('oil_pipeline', 'start', [37.61, 55.76], [pad])).toBeNull();
  });
});

describe('constrainLineCoordinatesOnEdit', () => {
  it('reverts moved endpoint when not on a point object', () => {
    const pad = pointObj('pad', 'oil_pad', 37.6, 55.75);
    const pool = [pad];
    const startAttach = findLineEndpointAttachment('oil_pipeline', 'start', [37.6, 55.75], pool);
    const finishAttach = findLineEndpointAttachment('oil_pipeline', 'finish', [37.7, 55.85], pool);
    const result = constrainLineCoordinatesOnEdit({
      lineSubtype: 'oil_pipeline',
      originalStart: [37.6, 55.75],
      originalFinish: [37.7, 55.85],
      originalStartAttach: startAttach,
      originalFinishAttach: finishAttach,
      draftCoords: [
        [37.61, 55.76],
        [37.65, 55.8],
        [37.71, 55.86],
      ],
      infraObjects: pool,
    });
    expect(result.coords[0]).toEqual([37.6, 55.75]);
    expect(result.revertedStart).toBe(true);
  });
});
