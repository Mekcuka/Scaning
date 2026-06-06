import manifest from '../../../../shared/infrastructure_subtypes.json';

/** Shared analysis/map linear lists — keep in sync via infrastructure_subtypes.json. */
export const MANIFEST_LINEAR_ALL = manifest.linear.all as readonly string[];
export const MANIFEST_ANALYSIS_INTERNAL_LINEAR = manifest.linear.analysis_internal as readonly string[];
export const MANIFEST_ANALYSIS_EXTERNAL_LINEAR = manifest.linear.analysis_external as readonly string[];
export const MANIFEST_ANALYSIS_EXTERNAL_POINT = manifest.point.analysis_external as readonly string[];
export const MANIFEST_MATRIX_POINT_EXCLUDE = manifest.matrix.point_exclude as readonly string[];
export const MANIFEST_MATRIX_INTERNAL_EXTRA_ROWS = manifest.matrix.internal_extra_rows as readonly string[];

export const LINE_SUBTYPES = [...MANIFEST_LINEAR_ALL] as const;
export const ANALYSIS_LINE_SUBTYPES = [...MANIFEST_ANALYSIS_INTERNAL_LINEAR] as const;
export const ANALYSIS_EXTERNAL_LINEAR_SUBTYPES = [...MANIFEST_ANALYSIS_EXTERNAL_LINEAR] as const;
export const ANALYSIS_EXTERNAL_POINT_SUBTYPES = [...MANIFEST_ANALYSIS_EXTERNAL_POINT] as const;
