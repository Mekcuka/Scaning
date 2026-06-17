import { describe, expect, it } from 'vitest';
import type { InfraLayer, InfraObject, POI } from '../api';
import {
  buildMapSearchHits,
  filterInfraByMapQuery,
  infraMatchesMapQuery,
  poiMatchesMapQuery,
} from './mapSearch';

const ctx = {
  layers: [{ id: 'layer-1', name: 'Дороги участка', is_visible: true } as InfraLayer],
  subtypeLabels: { autoroad: 'Автодорога' },
};

const infra = (over: Partial<InfraObject>): InfraObject =>
  ({
    id: 'i1',
    layer_id: 'layer-1',
    name: 'Дорога_1',
    subtype: 'autoroad',
    category: 'road',
    lon: 37.6,
    lat: 55.75,
    properties: { description: 'Подъезд к кусту' },
    ...over,
  }) as InfraObject;

const poi = (over: Partial<POI>): POI =>
  ({
    id: 'p1',
    project_id: 'proj',
    name: 'Куст А',
    lon: 37.6,
    lat: 55.75,
    fluid_type: 'oil',
    eng_power: 'external',
    ...over,
  }) as POI;

describe('infraMatchesMapQuery', () => {
  it('matches by name', () => {
    expect(infraMatchesMapQuery(infra({}), 'дорога', ctx).match).toBe(true);
  });

  it('matches by subtype label', () => {
    const r = infraMatchesMapQuery(infra({}), 'автодор', ctx);
    expect(r.match).toBe(true);
    expect(r.reason).toContain('Автодорога');
  });

  it('matches by property value', () => {
    const r = infraMatchesMapQuery(infra({}), 'кусту', ctx);
    expect(r.match).toBe(true);
    expect(r.reason).toBe('Свойство: Описание');
  });

  it('matches by layer name', () => {
    const r = infraMatchesMapQuery(infra({}), 'дороги участка', ctx);
    expect(r.match).toBe(true);
    expect(r.reason).toContain('Слой');
  });

  it('returns false for unrelated query', () => {
    expect(infraMatchesMapQuery(infra({}), 'нефтепровод', ctx).match).toBe(false);
  });
});

describe('poiMatchesMapQuery', () => {
  it('matches by fluid_type', () => {
    expect(poiMatchesMapQuery(poi({}), 'oil').match).toBe(true);
  });
});

describe('buildMapSearchHits', () => {
  it('returns limited hits with reasons', () => {
    const hits = buildMapSearchHits(
      [poi({ name: 'Куст А' })],
      [infra({ name: 'Дорога_2' })],
      'дорог',
      ctx,
      5,
    );
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((h) => h.kind === 'infra')).toBe(true);
  });
});

describe('filterInfraByMapQuery', () => {
  it('filters infra list', () => {
    const list = [infra({ name: 'A' }), infra({ name: 'БКНС', subtype: 'ground_pumping_station' })];
    const filtered = filterInfraByMapQuery(list, 'бкнс', ctx);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.name).toBe('БКНС');
  });
});
