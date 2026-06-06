import type { AnalysisRow } from '../api';
import type { EngineeringParamKey } from '../poiParams';

export interface MatrixCell {
  text: string;
  /** Second line (internal rows: formula / detail), smaller type in matrix UI */
  subtext?: string;
  status?: string;
  badge?: boolean;
}

export interface MatrixRow {
  label: string;
  section: string;
  cells: MatrixCell[];
  total?: boolean;
  engineering?: boolean;
  /** POI field for inline engineering dropdowns in the matrix table */
  engineeringKey?: EngineeringParamKey;
  /** Analysis row key (card view) */
  subtype?: string;
  paramType?: string;
}

export type MatrixCellPartsFn = (item: Record<string, unknown>) => {
  text: string;
  subtext?: string;
};

export type MatrixParamType = 'internal' | 'external_linear' | 'external';

export interface MatrixSectionDef {
  section: string;
  paramType: MatrixParamType;
  subtypes: readonly string[];
  /** Override label for special rows (e.g. pads). */
  labelOf?: (subtype: string) => string;
}

export interface PoiColumnAnalysis {
  rows: AnalysisRow[];
  total_cost_mln: number | null;
}
