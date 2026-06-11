import manifest from '../../../../shared/infrastructure_subtypes.json';

/** Shared map/analysis lists — keep in sync via infrastructure_subtypes.json. */
export const MANIFEST_LINEAR_ALL = manifest.linear.all as readonly string[];
export const MANIFEST_ANALYSIS_INTERNAL_LINEAR = manifest.linear.analysis_internal as readonly string[];
export const MANIFEST_ANALYSIS_EXTERNAL_LINEAR = manifest.linear.analysis_external as readonly string[];
export const MANIFEST_POINT_MAP = manifest.point.map as readonly string[];
export const MANIFEST_ANALYSIS_EXTERNAL_POINT = manifest.point.analysis_external as readonly string[];
export const MANIFEST_MATRIX_POINT_EXCLUDE = manifest.matrix.point_exclude as readonly string[];
export const MANIFEST_MATRIX_LINEAR_EXCLUDE = manifest.matrix.linear_exclude as readonly string[];
export const MANIFEST_MATRIX_INTERNAL_EXTRA_ROWS = manifest.matrix.internal_extra_rows as readonly string[];

export const MANIFEST_GKS_CLUSTER = manifest.clusters.gks as readonly string[];
export const MANIFEST_NODE_CLUSTER = manifest.clusters.node as readonly string[];
export const MANIFEST_PAD_CLUSTER = manifest.clusters.pad as readonly string[];
export const MANIFEST_GTES_CLUSTER = manifest.clusters.gtes as readonly string[];

export const MANIFEST_LEGACY_ALIASES = manifest.legacy_aliases as Readonly<Record<string, string>>;

export const MANIFEST_IMMUTABLE_POINT = manifest.point_policies.immutable as readonly string[];
export const MANIFEST_EXCLUSIVE_POINT = manifest.point_policies.exclusive as readonly string[];
export const MANIFEST_FACILITY_POINT = manifest.point_policies.facility as readonly string[];
export const MANIFEST_IMPORT_ONLY_POINT = manifest.point_policies.import_only as readonly string[];
export const MANIFEST_IE_DERIVED_POINT = manifest.point_policies.ie_derived as readonly string[];
export const MANIFEST_NODE_DERIVED_POINT = manifest.point_policies.node_derived as readonly string[];
export const MANIFEST_PAD_DERIVED_POINT = manifest.point_policies.pad_derived as readonly string[];
export const MANIFEST_SPARK_EXCLUSIVE_POINT = manifest.point_policies.spark_exclusive as readonly string[];

/** Subtypes hidden from «Точка» menu (import-only + IE-derived). */
export const MANIFEST_POINT_MENU_HIDDEN = [
  ...MANIFEST_IMPORT_ONLY_POINT,
  ...MANIFEST_IE_DERIVED_POINT,
] as const;

export const MANIFEST_SUBTYPE_LABELS = manifest.labels as Readonly<Record<string, string>>;
export const MANIFEST_SUBTYPE_CATEGORIES = manifest.categories as Readonly<Record<string, string>>;
export const MANIFEST_POINT_MENU_LABELS = manifest.point_menu_labels as Readonly<
  Record<string, string>
>;

export const LINE_SUBTYPES = [...MANIFEST_LINEAR_ALL] as const;
export const POINT_SUBTYPES = [...MANIFEST_POINT_MAP] as const;
export const ANALYSIS_LINE_SUBTYPES = [...MANIFEST_ANALYSIS_INTERNAL_LINEAR] as const;
export const ANALYSIS_EXTERNAL_LINEAR_SUBTYPES = [...MANIFEST_ANALYSIS_EXTERNAL_LINEAR] as const;
export const ANALYSIS_EXTERNAL_POINT_SUBTYPES = [...MANIFEST_ANALYSIS_EXTERNAL_POINT] as const;

export const GKS_CLUSTER_SUBTYPES = [...MANIFEST_GKS_CLUSTER] as const;
export const NODE_CLUSTER_SUBTYPES = [...MANIFEST_NODE_CLUSTER] as const;
export const PAD_CLUSTER_SUBTYPES = [...MANIFEST_PAD_CLUSTER] as const;
export const GTES_CLUSTER_SUBTYPES = [...MANIFEST_GTES_CLUSTER] as const;

export const LEGACY_SUBTYPE_ALIASES = { ...MANIFEST_LEGACY_ALIASES };
