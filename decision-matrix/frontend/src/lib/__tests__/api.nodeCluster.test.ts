import { describe, expect, it } from 'vitest';
import { infraSubtypeSelectOptions } from '../api';
import type { InfraObject } from '../api';

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

describe('infraSubtypeSelectOptions node cluster', () => {
  it('offers three node subtypes for a node object', () => {
    const opts = infraSubtypeSelectOptions(pointObject('node'));
    expect(opts.map((o) => o.value)).toEqual(['node', 'methanol_joint', 'power_line_node']);
    expect(opts.find((o) => o.value === 'power_line_node')?.label).toBe('Узел ЛЭП');
  });

  it('offers same cluster when current subtype is power_line_node', () => {
    const opts = infraSubtypeSelectOptions(pointObject('power_line_node'));
    expect(opts.map((o) => o.value)).toContain('node');
    expect(opts.map((o) => o.value)).toContain('methanol_joint');
  });
});
