import {
  ANALYSIS_LINE_SUBTYPES,
  type AnalysisRow,
} from '../api';
import { externalLinearMatrixCellParts } from './cellParts/externalLinear';
import { externalPointMatrixCellParts } from './cellParts/externalPoint';
import { internalMatrixCellParts } from './cellParts/internal';
import type { MatrixCell, MatrixCellPartsFn, MatrixParamType } from './types';

const INTERNAL_MATRIX_SUBTYPES = new Set<string>([...ANALYSIS_LINE_SUBTYPES, 'pads']);

function isInternalMatrixItem(item: Record<string, unknown>): boolean {
  const paramType = String(item.param_type || '');
  const subtype = String(item.subtype || '');
  return paramType === 'internal' || INTERNAL_MATRIX_SUBTYPES.has(subtype);
}

/** OCP registry: param_type → cell parts renderer. */
export const MATRIX_CELL_RENDERERS: Record<MatrixParamType, MatrixCellPartsFn> = {
  internal: internalMatrixCellParts,
  external_linear: externalLinearMatrixCellParts,
  external: externalPointMatrixCellParts,
};

export function matrixCellFromAnalysisItem(item: AnalysisRow): MatrixCell {
  const raw = item as unknown as Record<string, unknown>;
  if (isInternalMatrixItem(raw)) {
    const { text, subtext } = MATRIX_CELL_RENDERERS.internal(raw);
    return { text, subtext, status: item.status };
  }
  if (item.param_type === 'external_linear') {
    const { text, subtext } = MATRIX_CELL_RENDERERS.external_linear(raw);
    return { text, subtext, status: item.status };
  }
  const { text, subtext } = MATRIX_CELL_RENDERERS.external(raw);
  return { text, subtext, status: item.status };
}
