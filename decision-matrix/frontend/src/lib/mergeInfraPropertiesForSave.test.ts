import { describe, expect, it } from 'vitest';
import { mergeInfraPropertiesForSave } from './mergeInfraPropertiesForSave';

describe('mergeInfraPropertiesForSave', () => {
  it('does not set throughput for excluded subtypes', () => {
    const props = mergeInfraPropertiesForSave('node', {});
    expect(props.throughput_capacity_annual).toBeUndefined();
  });
});
