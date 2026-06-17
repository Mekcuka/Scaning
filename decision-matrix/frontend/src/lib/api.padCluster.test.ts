import { describe, expect, it } from 'vitest';
import {
  infraSubtypeSelectOptions,
  MAP_DRAWABLE_LINE_SUBTYPES,
  MAP_DRAWABLE_POINT_SUBTYPES,
  PAD_CLUSTER_SUBTYPES,
  pointMenuLabel,
} from './api';
import type { InfraObject } from './api';

function pointObject(subtype: string): InfraObject {
  return {
    id: 'obj-1',
    name: 'Test',
    subtype,
    category: 'point',
    lon: 37.6,
    lat: 55.75,
    layer_id: '',
    properties: {},
  } as InfraObject;
}

describe('infraSubtypeSelectOptions pad cluster', () => {
  it('offers oil and gas pad subtypes for oil_pad', () => {
    const opts = infraSubtypeSelectOptions(pointObject('oil_pad'));
    expect(opts.map((o) => o.value)).toEqual([...PAD_CLUSTER_SUBTYPES]);
    expect(opts.find((o) => o.value === 'gas_pad')?.label).toBe('Газовый куст');
  });

  it('offers same cluster when current subtype is gas_pad', () => {
    const opts = infraSubtypeSelectOptions(pointObject('gas_pad'));
    expect(opts.map((o) => o.value)).toContain('oil_pad');
    expect(opts.map((o) => o.value)).toContain('gas_pad');
  });

  it('shows single «Куст» in draw menu (oil_pad only, not gas_pad)', () => {
    expect(MAP_DRAWABLE_POINT_SUBTYPES).toContain('oil_pad');
    expect(MAP_DRAWABLE_POINT_SUBTYPES).not.toContain('gas_pad');
    expect(pointMenuLabel('oil_pad')).toBe('Куст');
  });

  it('includes methanol_facility in draw menu', () => {
    expect(MAP_DRAWABLE_POINT_SUBTYPES).toContain('methanol_facility');
    expect(pointMenuLabel('methanol_facility')).toBe('Объект метанола');
  });

  it('excludes bottomholes from «Точка» menu (отдельная кнопка «Забой» на панели)', () => {
    expect(MAP_DRAWABLE_POINT_SUBTYPES).not.toContain('well_bottomhole_nnb');
    expect(MAP_DRAWABLE_POINT_SUBTYPES).not.toContain('well_bottomhole_gs_heel');
    expect(MAP_DRAWABLE_POINT_SUBTYPES).not.toContain('well_bottomhole_gs_toe');
  });

  it('excludes ГС from «Линия» menu (создание через кнопку «Забой»)', () => {
    expect(MAP_DRAWABLE_LINE_SUBTYPES).not.toContain('well_bottomhole_gs');
  });

  it('locks methanol_facility subtype in detail panel', () => {
    const opts = infraSubtypeSelectOptions(pointObject('methanol_facility'));
    expect(opts).toEqual([{ value: 'methanol_facility', label: 'Объект метанола' }]);
  });
});
