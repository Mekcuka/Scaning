import { describe, expect, it } from 'vitest';
import type { Map3dCustomModel } from '../api';
import { buildRender3dModelOptions, render3dModelSelectValue } from './render3dModelOptions';

const baseModel = (overrides: Partial<Map3dCustomModel>): Map3dCustomModel => ({
  id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  project_id: 'p1',
  filename: 'tank.glb',
  target_height_m: 8,
  created_at: '2026-01-01T00:00:00Z',
  assigned_subtypes: [],
  ...overrides,
});

describe('render3dModelOptions', () => {
  it('includes standard and custom models for matching subtype', () => {
    const models = [
      baseModel({ assigned_subtypes: ['node'], filename: 'drum.glb' }),
      baseModel({
        id: 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff',
        assigned_subtypes: ['substation'],
        filename: 'sub.glb',
      }),
    ];
    const opts = buildRender3dModelOptions('node', models);
    expect(opts[0]!.value).toBe('');
    expect(opts[0]!.label).toContain('Стандартная');
    expect(opts[1]!.value).toBe('custom:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    expect(opts[1]!.label).toBe('drum.glb');
    expect(opts).toHaveLength(2);
  });

  it('includes model when any assigned subtype matches', () => {
    const models = [baseModel({ assigned_subtypes: ['node', 'gtes'], filename: 'shared.glb' })];
    expect(buildRender3dModelOptions('gtes', models)).toHaveLength(2);
    expect(buildRender3dModelOptions('substation', models)).toHaveLength(1);
  });

  it('maps empty select value for standard', () => {
    expect(render3dModelSelectValue('node', [], '')).toBe('');
    expect(
      render3dModelSelectValue(
        'node',
        [baseModel({ assigned_subtypes: ['node'] })],
        'custom:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      ),
    ).toBe('custom:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
  });

  it('matches legacy pad assignment to oil_pad', () => {
    const models = [baseModel({ assigned_subtypes: ['pad'], filename: 'legacy-pad.glb' })];
    const opts = buildRender3dModelOptions('oil_pad', models);
    expect(opts).toHaveLength(2);
    expect(opts[1]!.label).toBe('legacy-pad.glb');
  });
});
