import { describe, expect, it } from 'vitest';
import manifest from '../../../../shared/infrastructure_subtypes.json';
import {
  ANALYSIS_EXTERNAL_LINEAR_SUBTYPES,
  ANALYSIS_EXTERNAL_POINT_SUBTYPES,
  ANALYSIS_LINE_SUBTYPES,
  LINE_SUBTYPES,
  MANIFEST_MATRIX_INTERNAL_EXTRA_ROWS,
  MANIFEST_MATRIX_POINT_EXCLUDE,
} from './infrastructureSubtypesManifest';

describe('infrastructureSubtypesManifest', () => {
  it('loads analysis lists from shared JSON', () => {
    expect([...ANALYSIS_LINE_SUBTYPES]).toEqual(manifest.linear.analysis_internal);
    expect([...ANALYSIS_EXTERNAL_LINEAR_SUBTYPES]).toEqual(manifest.linear.analysis_external);
    expect([...ANALYSIS_EXTERNAL_POINT_SUBTYPES]).toEqual(manifest.point.analysis_external);
    expect([...LINE_SUBTYPES]).toEqual(manifest.linear.all);
  });

  it('matrix helpers match manifest', () => {
    expect([...MANIFEST_MATRIX_POINT_EXCLUDE]).toEqual(manifest.matrix.point_exclude);
    expect([...MANIFEST_MATRIX_INTERNAL_EXTRA_ROWS]).toEqual(manifest.matrix.internal_extra_rows);
  });

  it('internal linear subtypes are subset of external linear', () => {
    for (const subtype of ANALYSIS_LINE_SUBTYPES) {
      expect(ANALYSIS_EXTERNAL_LINEAR_SUBTYPES).toContain(subtype);
    }
  });
});
