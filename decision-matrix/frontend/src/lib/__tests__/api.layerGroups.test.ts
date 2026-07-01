import { describe, expect, it } from 'vitest';
import {
  ALL_MAP_SUBTYPES,
  BOTTOMHOLE_LAYER_SUBTYPES,
  BOTTOMHOLE_LAYER_VISIBILITY_GROUPS,
  LAYER_VISIBILITY_GROUPS,
  LINE_LAYER_UI_ENTRIES,
  LINE_LAYER_VISIBILITY_GROUPS,
  PIPELINE_LAYER_SUBTYPES,
  PIPELINE_LAYER_VISIBILITY_GROUPS,
  POINT_LAYER_VISIBILITY_GROUPS,
  layerGroupKind,
} from '../api';

describe('LAYER_VISIBILITY_GROUPS', () => {
  it('covers every map subtype exactly once', () => {
    const covered = LAYER_VISIBILITY_GROUPS.flatMap((g) => g.subtypes);
    const seen = new Set<string>();
    for (const st of covered) {
      expect(seen.has(st)).toBe(false);
      seen.add(st);
    }
    for (const st of ALL_MAP_SUBTYPES) {
      expect(seen.has(st)).toBe(true);
    }
    expect(seen.size).toBe(ALL_MAP_SUBTYPES.length);
  });

  it('splits groups into point, bottomhole and line categories without overlap', () => {
    expect(
      POINT_LAYER_VISIBILITY_GROUPS.length +
        BOTTOMHOLE_LAYER_VISIBILITY_GROUPS.length +
        LINE_LAYER_VISIBILITY_GROUPS.length,
    ).toBe(LAYER_VISIBILITY_GROUPS.length);
    for (const group of POINT_LAYER_VISIBILITY_GROUPS) {
      expect(layerGroupKind(group)).toBe('point');
    }
    for (const group of BOTTOMHOLE_LAYER_VISIBILITY_GROUPS) {
      expect(layerGroupKind(group)).toBe('point');
      for (const st of group.subtypes) {
        expect(BOTTOMHOLE_LAYER_SUBTYPES).toContain(st);
      }
    }
    for (const group of LINE_LAYER_VISIBILITY_GROUPS) {
      expect(layerGroupKind(group)).toBe('line');
    }
  });

  it('lists pipeline subtypes separately under Трубопроводы', () => {
    expect(PIPELINE_LAYER_VISIBILITY_GROUPS.map((g) => g.id)).toEqual([
      'oil_pipeline',
      'water_pipeline',
      'gas_pipeline',
      'methanol_pipeline',
    ]);
    expect(PIPELINE_LAYER_SUBTYPES).toEqual([
      'oil_pipeline',
      'water_pipeline',
      'gas_pipeline',
      'methanol_pipeline',
    ]);
    const pipelineEntry = LINE_LAYER_UI_ENTRIES.find((e) => e.kind === 'subcategory');
    expect(pipelineEntry?.kind).toBe('subcategory');
    if (pipelineEntry?.kind === 'subcategory') {
      expect(pipelineEntry.title).toBe('Трубопроводы');
      expect(pipelineEntry.groups).toHaveLength(4);
    }
  });
});
