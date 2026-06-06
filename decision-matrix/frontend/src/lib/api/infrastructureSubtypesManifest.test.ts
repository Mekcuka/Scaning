import { describe, expect, it } from 'vitest';
import manifest from '../../../../shared/infrastructure_subtypes.json';
import {
  ANALYSIS_EXTERNAL_LINEAR_SUBTYPES,
  ANALYSIS_EXTERNAL_POINT_SUBTYPES,
  ANALYSIS_LINE_SUBTYPES,
  GKS_CLUSTER_SUBTYPES,
  GTES_CLUSTER_SUBTYPES,
  LEGACY_SUBTYPE_ALIASES,
  LINE_SUBTYPES,
  MANIFEST_MATRIX_INTERNAL_EXTRA_ROWS,
  MANIFEST_MATRIX_POINT_EXCLUDE,
  NODE_CLUSTER_SUBTYPES,
  PAD_CLUSTER_SUBTYPES,
  POINT_SUBTYPES,
} from './infrastructureSubtypesManifest';
import { normalizeInfraSubtype } from './subtypes';

describe('infrastructureSubtypesManifest', () => {
  it('loads v2 map and analysis lists from shared JSON', () => {
    expect(manifest.version).toBe(2);
    expect([...POINT_SUBTYPES]).toEqual(manifest.point.map);
    expect([...ANALYSIS_LINE_SUBTYPES]).toEqual(manifest.linear.analysis_internal);
    expect([...ANALYSIS_EXTERNAL_LINEAR_SUBTYPES]).toEqual(manifest.linear.analysis_external);
    expect([...ANALYSIS_EXTERNAL_POINT_SUBTYPES]).toEqual(manifest.point.analysis_external);
    expect([...LINE_SUBTYPES]).toEqual(manifest.linear.all);
  });

  it('loads clusters and legacy aliases from shared JSON', () => {
    expect([...GKS_CLUSTER_SUBTYPES]).toEqual(manifest.clusters.gks);
    expect([...NODE_CLUSTER_SUBTYPES]).toEqual(manifest.clusters.node);
    expect([...PAD_CLUSTER_SUBTYPES]).toEqual(manifest.clusters.pad);
    expect([...GTES_CLUSTER_SUBTYPES]).toEqual(manifest.clusters.gtes);
    expect(LEGACY_SUBTYPE_ALIASES).toEqual(manifest.legacy_aliases);
    expect(normalizeInfraSubtype('delivery_acceptance_point')).toBe('refinery');
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

  it('analysis external points are on the map', () => {
    for (const subtype of ANALYSIS_EXTERNAL_POINT_SUBTYPES) {
      expect(POINT_SUBTYPES).toContain(subtype);
    }
  });
});
