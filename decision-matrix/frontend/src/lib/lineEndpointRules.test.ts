import { describe, expect, it } from 'vitest';
import type { InfraObject } from './api';
import {
  constrainLineCoordinatesOnEdit,
  findLineEndpointAttachment,
  lineEndpointAttachmentsFromObject,
  nearestPointLineEndpoint,
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
    const objects = [pointObj('1', 'pad', 37.6, 55.75)];
    const snapped = snapLineDrawPoint(
      'autoroad',
      [38, 56],
      objects,
      { lon: 37.6, lat: 55.75 },
    );
    expect(snapped).toEqual([37.6, 55.75]);
  });

  it('snaps by distance when no cursor hit', () => {
    const objects = [pointObj('1', 'gas_processing', 37.6, 55.75)];
    const snapped = snapLineDrawPoint('autoroad', [37.6001, 55.7501], objects);
    expect(snapped).toEqual([37.6, 55.75]);
  });
});

describe('nearestPointLineEndpoint', () => {
  it('snaps to nearest point object regardless of line subtype', () => {
    const objects = [pointObj('1', 'pad', 37.6, 55.75)];
    const nearest = nearestPointLineEndpoint('oil_pipeline', 'finish', [37.6001, 55.7501], objects);
    expect(nearest).not.toBeNull();
    expect(nearest!.object.subtype).toBe('pad');
    expect(nearest!.distanceKm).toBeLessThan(0.3);
  });

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

  it('plans node creation for additional_line in empty space', () => {
    const objects = [pointObj('1', 'node', 37.6, 55.75)];
    const resolved = resolveLineEndpoint('additional_line', 'finish', [38.0, 56.0], objects);
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.createNode).toBe(true);
    }
  });
});

describe('lineEndpointAttachmentsFromObject', () => {
  it('finds attachments via snapPool when node is not in infraObjects', () => {
    const pad = pointObj('pad-1', 'pad', 37.6, 55.75);
    const node = pointObj('node-1', 'node', 37.7, 55.85);
    const lineObj = {
      id: 'line-1',
      name: 'line',
      subtype: 'oil_pipeline',
      category: 'linear',
      lon: 37.6001,
      lat: 55.7501,
      end_lon: 37.7001,
      end_lat: 55.8501,
      coordinates: [
        [37.6001, 55.7501],
        [37.7001, 55.8501],
      ],
      layer_id: 'layer-1',
      project_id: 'p1',
      properties: {},
    } as InfraObject;
    const pool = [pad, node, lineObj];
    const attachments = lineEndpointAttachmentsFromObject(lineObj, [lineObj], pool);
    expect(attachments?.startAttach?.object.id).toBe('pad-1');
    expect(attachments?.finishAttach?.object.id).toBe('node-1');
  });
});

describe('normalizeLinePathEndpoints', () => {
  it('replaces endpoints with exact object coordinates', () => {
    const pad = pointObj('pad-1', 'pad', 37.6, 55.75);
    const path = normalizeLinePathEndpoints(
      'power_line',
      [
        [37.6001, 55.7501],
        [37.62, 55.76],
      ],
      [pad],
    );
    expect(path[0]).toEqual([37.6, 55.75]);
    expect(path[1]).toEqual([37.62, 55.76]);
  });

  it('snaps line ends to node objects (not only pad/substation)', () => {
    const nodeA = pointObj('n1', 'node', 37.6, 55.75);
    const nodeB = pointObj('n2', 'node', 37.7, 55.85);
    const path = normalizeLinePathEndpoints(
      'gas_pipeline',
      [
        [37.6001, 55.7501],
        [37.7001, 55.8501],
      ],
      [nodeA, nodeB],
    );
    expect(path[0]).toEqual([37.6, 55.75]);
    expect(path[1]).toEqual([37.7, 55.85]);
  });
});

describe('constrainLineCoordinatesOnEdit', () => {
  it('reverts endpoint to original point object when dropped in empty space', () => {
    const nodeA = pointObj('n1', 'node', 37.6, 55.75);
    const nodeB = pointObj('n2', 'node', 37.7, 55.85);
    const pool = [nodeA, nodeB];
    const startAttach = findLineEndpointAttachment('oil_pipeline', 'start', [37.6, 55.75], pool);
    const finishAttach = findLineEndpointAttachment('oil_pipeline', 'finish', [37.7, 55.85], pool);
    expect(startAttach).not.toBeNull();
    expect(finishAttach).not.toBeNull();

    const result = constrainLineCoordinatesOnEdit({
      lineSubtype: 'oil_pipeline',
      originalStart: [37.6, 55.75],
      originalFinish: [37.7, 55.85],
      originalStartAttach: startAttach,
      originalFinishAttach: finishAttach,
      draftCoords: [
        [37.6, 55.75],
        [37.65, 55.8],
        [38.5, 56.5],
      ],
      infraObjects: pool,
    });

    expect(result.revertedFinish).toBe(true);
    expect(result.coords[0]).toEqual([37.6, 55.75]);
    expect(result.coords[result.coords.length - 1]).toEqual([37.7, 55.85]);
  });

  it('reconnects endpoint to another nearby point object', () => {
    const nodeA = pointObj('n1', 'node', 37.6, 55.75);
    const nodeB = pointObj('n2', 'node', 37.7, 55.85);
    const nodeC = pointObj('n3', 'pad', 37.8001, 55.9501);
    const pool = [nodeA, nodeB, nodeC];
    const startAttach = findLineEndpointAttachment('oil_pipeline', 'start', [37.6, 55.75], pool);
    const finishAttach = findLineEndpointAttachment('oil_pipeline', 'finish', [37.7, 55.85], pool);

    const result = constrainLineCoordinatesOnEdit({
      lineSubtype: 'oil_pipeline',
      originalStart: [37.6, 55.75],
      originalFinish: [37.7, 55.85],
      originalStartAttach: startAttach,
      originalFinishAttach: finishAttach,
      draftCoords: [
        [37.6, 55.75],
        [37.8001, 55.9501],
      ],
      infraObjects: pool,
    });

    expect(result.revertedFinish).toBe(false);
    expect(result.reconnectedFinish).toBe(true);
    expect(result.coords[result.coords.length - 1]).toEqual([37.8001, 55.9501]);
  });

  it('does not revert endpoints when only a middle vertex moves', () => {
    const nodeA = pointObj('n1', 'node', 37.6, 55.75);
    const nodeB = pointObj('n2', 'node', 37.7, 55.85);
    const pool = [nodeA, nodeB];
    const startAttach = findLineEndpointAttachment('oil_pipeline', 'start', [37.6, 55.75], pool);
    const finishAttach = findLineEndpointAttachment('oil_pipeline', 'finish', [37.7, 55.85], pool);

    const result = constrainLineCoordinatesOnEdit({
      lineSubtype: 'oil_pipeline',
      originalStart: [37.6, 55.75],
      originalFinish: [37.7, 55.85],
      originalStartAttach: startAttach,
      originalFinishAttach: finishAttach,
      draftCoords: [
        [37.6, 55.75],
        [37.65, 55.82],
        [37.7, 55.85],
      ],
      infraObjects: pool,
    });

    expect(result.revertedStart).toBe(false);
    expect(result.revertedFinish).toBe(false);
    expect(result.coords[1]).toEqual([37.65, 55.82]);
  });

  it('does not revert unattached endpoints when only a middle vertex moves', () => {
    const nodeA = pointObj('n1', 'node', 37.6, 55.75);
    const pool = [nodeA];

    const result = constrainLineCoordinatesOnEdit({
      lineSubtype: 'autoroad',
      originalStart: [37.5, 55.7],
      originalFinish: [37.8, 55.9],
      originalStartAttach: null,
      originalFinishAttach: null,
      draftCoords: [
        [37.5, 55.7],
        [37.65, 55.82],
        [37.8, 55.9],
      ],
      infraObjects: pool,
    });

    expect(result.revertedStart).toBe(false);
    expect(result.revertedFinish).toBe(false);
    expect(result.coords[1]).toEqual([37.65, 55.82]);
  });

  it('reconnects via cursor target when draft coords are far from any object', () => {
    const nodeA = pointObj('n1', 'node', 37.6, 55.75);
    const nodeB = pointObj('n2', 'node', 37.7, 55.85);
    const nodeC = pointObj('n3', 'booster_pumping_station', 37.8, 55.95);
    const pool = [nodeA, nodeB, nodeC];
    const startAttach = findLineEndpointAttachment('water_pipeline', 'start', [37.6, 55.75], pool);
    const finishAttach = findLineEndpointAttachment('water_pipeline', 'finish', [37.7, 55.85], pool);

    const result = constrainLineCoordinatesOnEdit({
      lineSubtype: 'water_pipeline',
      originalStart: [37.6, 55.75],
      originalFinish: [37.7, 55.85],
      originalStartAttach: startAttach,
      originalFinishAttach: finishAttach,
      draftCoords: [
        [37.6, 55.75],
        [38.5, 56.5],
      ],
      infraObjects: pool,
      cursorTargetFinish: nodeC,
    });

    expect(result.revertedFinish).toBe(false);
    expect(result.reconnectedFinish).toBe(true);
    expect(result.coords[result.coords.length - 1]).toEqual([37.8, 55.95]);
  });
});
