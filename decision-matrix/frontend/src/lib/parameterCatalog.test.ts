import { describe, expect, it } from 'vitest';
import {
  buildDefaultDistanceDefaults,
  effectiveDistanceDefaults,
  sparseNumericOverrides,
} from './parameterCatalog';

describe('effectiveDistanceDefaults', () => {
  it('inherits project template when POI fields are null', () => {
    const project = buildDefaultDistanceDefaults();
    const effective = effectiveDistanceDefaults(
      { threshold_gas_processing_km: null, km_per_pad_autoroad: null },
      project,
    );
    expect(effective.threshold_gas_processing_km).toBe(project.threshold_gas_processing_km);
  });

  it('uses POI override when set', () => {
    const project = buildDefaultDistanceDefaults();
    const effective = effectiveDistanceDefaults({ threshold_gas_processing_km: 99 }, project);
    expect(effective.threshold_gas_processing_km).toBe(99);
  });
});

describe('sparseNumericOverrides', () => {
  it('returns null when effective matches project', () => {
    const base = { a: 1, b: 2 };
    expect(sparseNumericOverrides(base, base)).toBeNull();
  });

  it('returns only differing keys', () => {
    const project = { a: 1, b: 2 };
    const effective = { a: 5, b: 2 };
    expect(sparseNumericOverrides(effective, project)).toEqual({ a: 5 });
  });
});
