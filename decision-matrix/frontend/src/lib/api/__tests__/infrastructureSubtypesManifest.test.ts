import { describe, expect, it } from 'vitest';
import manifest from '../../../../../shared/infrastructure_subtypes.json';
import {
  ANALYSIS_EXTERNAL_LINEAR_SUBTYPES,
  ANALYSIS_EXTERNAL_POINT_SUBTYPES,
  ANALYSIS_LINE_SUBTYPES,
  GKS_CLUSTER_SUBTYPES,
  GTES_CLUSTER_SUBTYPES,
  LEGACY_SUBTYPE_ALIASES,
  LINE_SUBTYPES,
  MANIFEST_EXCLUSIVE_POINT,
  MANIFEST_FACILITY_POINT,
  MANIFEST_IMMUTABLE_POINT,
  MANIFEST_IMPORT_ONLY_POINT,
  MANIFEST_IE_DERIVED_POINT,
  MANIFEST_MATRIX_INTERNAL_EXTRA_ROWS,
  MANIFEST_MATRIX_LINEAR_EXCLUDE,
  MANIFEST_MATRIX_POINT_EXCLUDE,
  MANIFEST_NODE_DERIVED_POINT,
  MANIFEST_PAD_DERIVED_POINT,
  MANIFEST_POINT_MENU_HIDDEN,
  MANIFEST_POINT_MENU_LABELS,
  MANIFEST_SPARK_EXCLUSIVE_POINT,
  MANIFEST_SUBTYPE_LABELS,
  NODE_CLUSTER_SUBTYPES,
  PAD_CLUSTER_SUBTYPES,
  POINT_SUBTYPES,
} from '../infrastructureSubtypesManifest';
import { normalizeInfraSubtype } from '../subtypes';

describe('infrastructureSubtypesManifest', () => {
  it('loads v4 map and analysis lists from shared JSON', () => {
    expect(manifest.version).toBe(4);
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
    expect([...MANIFEST_MATRIX_LINEAR_EXCLUDE]).toEqual(manifest.matrix.linear_exclude);
    expect([...MANIFEST_MATRIX_INTERNAL_EXTRA_ROWS]).toEqual(manifest.matrix.internal_extra_rows);
  });

  it('point policies match manifest', () => {
    expect([...MANIFEST_IMMUTABLE_POINT]).toEqual(manifest.point_policies.immutable);
    expect([...MANIFEST_EXCLUSIVE_POINT]).toEqual(manifest.point_policies.exclusive);
    expect([...MANIFEST_FACILITY_POINT]).toEqual(manifest.point_policies.facility);
    expect([...MANIFEST_IMPORT_ONLY_POINT]).toEqual(manifest.point_policies.import_only);
    expect([...MANIFEST_IE_DERIVED_POINT]).toEqual(manifest.point_policies.ie_derived);
    expect([...MANIFEST_NODE_DERIVED_POINT]).toEqual(manifest.point_policies.node_derived);
    expect([...MANIFEST_PAD_DERIVED_POINT]).toEqual(manifest.point_policies.pad_derived);
    expect([...MANIFEST_SPARK_EXCLUSIVE_POINT]).toEqual(manifest.point_policies.spark_exclusive);
    expect([...MANIFEST_POINT_MENU_HIDDEN]).toEqual([
      ...manifest.point_policies.import_only,
      ...manifest.point_policies.ie_derived,
    ]);
  });

  it('labels and point menu labels match manifest', () => {
    expect(MANIFEST_SUBTYPE_LABELS).toEqual(manifest.labels);
    expect(MANIFEST_POINT_MENU_LABELS).toEqual(manifest.point_menu_labels);
    for (const subtype of POINT_SUBTYPES) {
      expect(MANIFEST_SUBTYPE_LABELS[subtype]).toBeTruthy();
    }
    for (const subtype of LINE_SUBTYPES) {
      expect(MANIFEST_SUBTYPE_LABELS[subtype]).toBeTruthy();
    }
  });

  it('internal linear subtypes are subset of external linear', () => {
    for (const subtype of ANALYSIS_LINE_SUBTYPES) {
      expect(ANALYSIS_EXTERNAL_LINEAR_SUBTYPES).toContain(subtype);
    }
  });

  it('includes gas_pipeline in internal linear analysis', () => {
    expect(ANALYSIS_LINE_SUBTYPES).toContain('gas_pipeline');
    expect(MANIFEST_SUBTYPE_LABELS.gas_pipeline).toBe('Газопровод');
  });

  it('analysis external points are on the map', () => {
    for (const subtype of ANALYSIS_EXTERNAL_POINT_SUBTYPES) {
      expect(POINT_SUBTYPES).toContain(subtype);
    }
  });
});
