import { describe, expect, it } from 'vitest';
import {
  defaultPadPlacementVariantIndex,
  findPadPlacementVariant,
  normalizePadPlacementComputeResponse,
} from '../padPlacementCompute';

describe('padPlacementCompute helpers', () => {
  it('normalizes partial async job payloads', () => {
    const data = normalizePadPlacementComputeResponse({
      request_id: 'req-1',
      logical_well_count: 2,
      variants: [{ variant_index: 0, pad_count: 1, sum_md_m: 100, score_warnings: [], invalid: false, min_sf: null }],
    });
    expect(data.request_id).toBe('req-1');
    expect(data.variants).toHaveLength(1);
  });

  it('picks first variant index for apply', () => {
    expect(
      defaultPadPlacementVariantIndex([
        { variant_index: 2, pad_count: 1, sum_md_m: 1, score_warnings: [], invalid: false, min_sf: null },
      ]),
    ).toBe(2);
    expect(defaultPadPlacementVariantIndex([])).toBeNull();
  });

  it('finds variant by index with positional fallback', () => {
    const result = normalizePadPlacementComputeResponse({
      request_id: 'req-1',
      logical_well_count: 1,
      variants: [{ variant_index: 3, pad_count: 1, sum_md_m: 1, score_warnings: [], invalid: false, min_sf: null }],
    });
    expect(findPadPlacementVariant(result, 3)?.variant_index).toBe(3);
    expect(findPadPlacementVariant(result, 0)?.variant_index).toBe(3);
  });
});
