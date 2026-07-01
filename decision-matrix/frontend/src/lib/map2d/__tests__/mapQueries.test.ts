import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import type { InfraObject } from '../../api';
import { removeInfraObjectsFromQueries, upsertInfraObjectInQueries } from '../mapQueries';

function stubInfra(id: string): InfraObject {
  return {
    id,
    layer_id: 'l1',
    name: id,
    subtype: 'node',
    category: 'internal',
    lon: 1,
    lat: 2,
    properties: {},
  };
}

describe('upsertInfraObjectInQueries', () => {
  it('updates full list and active bbox viewport cache', () => {
    const qc = new QueryClient();
    const bbox = '0,0,1,1';
    const existing = stubInfra('old');
    qc.setQueryData(['infra', 'p1'], [existing]);
    qc.setQueryData(['infra', 'p1', 'bbox', bbox], [existing]);

    const created = stubInfra('new');
    upsertInfraObjectInQueries(qc, 'p1', created);

    expect(qc.getQueryData<InfraObject[]>(['infra', 'p1'])?.map((o) => o.id)).toEqual([
      'old',
      'new',
    ]);
    expect(qc.getQueryData<InfraObject[]>(['infra', 'p1', 'bbox', bbox])?.map((o) => o.id)).toEqual(
      ['old', 'new'],
    );
  });

  it('removes ids from full list and bbox viewport cache', () => {
    const qc = new QueryClient();
    const bbox = '0,0,1,1';
    qc.setQueryData(['infra', 'p1'], [stubInfra('a'), stubInfra('b')]);
    qc.setQueryData(['infra', 'p1', 'bbox', bbox], [stubInfra('a'), stubInfra('b')]);

    removeInfraObjectsFromQueries(qc, 'p1', ['b']);

    expect(qc.getQueryData<InfraObject[]>(['infra', 'p1'])?.map((o) => o.id)).toEqual(['a']);
    expect(qc.getQueryData<InfraObject[]>(['infra', 'p1', 'bbox', bbox])?.map((o) => o.id)).toEqual([
      'a',
    ]);
  });
});
