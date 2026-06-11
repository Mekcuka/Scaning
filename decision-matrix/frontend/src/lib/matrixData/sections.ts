import {
  ANALYSIS_EXTERNAL_LINEAR_SUBTYPES,
  ANALYSIS_LINE_SUBTYPES,
  MANIFEST_MATRIX_INTERNAL_EXTRA_ROWS,
  MANIFEST_MATRIX_LINEAR_EXCLUDE,
  MANIFEST_MATRIX_POINT_EXCLUDE,
  POINT_SUBTYPES,
  SUBTYPE_LABELS,
} from '../api';
import type { MatrixSectionDef } from './types';

/** Point subtypes in the comparison matrix (excludes connection nodes on the map). */
const MATRIX_POINT_SUBTYPES = POINT_SUBTYPES.filter(
  (s) => !MANIFEST_MATRIX_POINT_EXCLUDE.includes(s),
);

const MATRIX_EXTERNAL_LINEAR_SUBTYPES = ANALYSIS_EXTERNAL_LINEAR_SUBTYPES.filter(
  (s) => !MANIFEST_MATRIX_LINEAR_EXCLUDE.includes(s),
);

function defaultLabel(subtype: string): string {
  return SUBTYPE_LABELS[subtype] || subtype;
}

/** OCP registry: add a matrix row by appending a subtype to the matching section. */
export const MATRIX_SECTIONS: readonly MatrixSectionDef[] = [
  {
    section: 'Внутренние решения',
    paramType: 'internal',
    subtypes: [...ANALYSIS_LINE_SUBTYPES, ...MANIFEST_MATRIX_INTERNAL_EXTRA_ROWS],
    labelOf: (subtype) =>
      subtype === 'pads' ? 'Кустовые площадки' : defaultLabel(subtype),
  },
  {
    section: 'Внешние линейные объекты',
    paramType: 'external_linear',
    subtypes: MATRIX_EXTERNAL_LINEAR_SUBTYPES,
    labelOf: defaultLabel,
  },
  {
    section: 'Внешние объекты',
    paramType: 'external',
    subtypes: MATRIX_POINT_SUBTYPES,
    labelOf: defaultLabel,
  },
];
