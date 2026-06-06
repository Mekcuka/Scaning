import {
  ANALYSIS_LINE_SUBTYPES,
  EXTERNAL_LINEAR_SUBTYPES,
  POINT_SUBTYPES,
  SUBTYPE_LABELS,
} from '../api';
import type { MatrixSectionDef } from './types';

/** Point subtypes in the comparison matrix (excludes connection nodes on the map). */
const MATRIX_POINT_SUBTYPES = POINT_SUBTYPES.filter((s) => s !== 'node');

function defaultLabel(subtype: string): string {
  return SUBTYPE_LABELS[subtype] || subtype;
}

/** OCP registry: add a matrix row by appending a subtype to the matching section. */
export const MATRIX_SECTIONS: readonly MatrixSectionDef[] = [
  {
    section: 'Внутренние решения',
    paramType: 'internal',
    subtypes: [...ANALYSIS_LINE_SUBTYPES, 'pads'],
    labelOf: (subtype) => (subtype === 'pads' ? 'Кустовые площадки' : defaultLabel(subtype)),
  },
  {
    section: 'Внешние линейные объекты',
    paramType: 'external_linear',
    subtypes: EXTERNAL_LINEAR_SUBTYPES,
    labelOf: defaultLabel,
  },
  {
    section: 'Внешние объекты',
    paramType: 'external',
    subtypes: MATRIX_POINT_SUBTYPES,
    labelOf: defaultLabel,
  },
];
