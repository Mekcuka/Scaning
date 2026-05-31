import { describe, expect, it } from 'vitest';
import { internalMatrixCellParts, externalLinearMatrixCellParts } from './matrixData';

describe('matrixData', () => {
  it('internalMatrixCellParts formats cost', () => {
    const parts = internalMatrixCellParts({ cost_mln: 12.5, subtype: 'pads', pads_count: 3 });
    expect(parts.text).toContain('12.5');
    expect(parts.subtext).toContain('3');
  });

  it('externalLinearMatrixCellParts handles not_required', () => {
    expect(externalLinearMatrixCellParts({ status: 'not_required' }).text).toBe('Не треб.');
  });
});
