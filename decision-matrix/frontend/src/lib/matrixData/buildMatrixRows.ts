import type { AnalysisRow, POI } from '../api';
import { fluidTypeLabel, plannedProductionLabel } from '../poiParams';
import { matrixCellFromAnalysisItem } from './cellRenderer';
import { buildEngineeringMatrixRows } from './engineeringRows';
import { MATRIX_SECTIONS } from './sections';
import type { MatrixCell, MatrixRow, PoiColumnAnalysis } from './types';

function findAnalysisRow(
  rows: AnalysisRow[],
  subtype: string,
  paramType: string
): AnalysisRow | undefined {
  return rows.find((a) => a.subtype === subtype && a.param_type === paramType);
}

/** Matrix columns = one per POI; cells from live analysis. */
export function buildMatrixRowsByPois(
  pois: POI[],
  columnAnalysis: PoiColumnAnalysis[]
): { rows: MatrixRow[]; columnNames: string[]; poisByColumn: POI[] } {
  const columnNames = pois.map((p) => p.name);
  const poisByColumn = pois;
  const rows: MatrixRow[] = [];

  rows.push({
    label: 'Флюид',
    section: 'Точка интереса',
    cells: pois.map((poi) => ({
      text: fluidTypeLabel(poi.fluid_type),
      subtext: plannedProductionLabel(poi),
    })),
  });

  rows.push(...buildEngineeringMatrixRows(pois));

  for (const section of MATRIX_SECTIONS) {
    const labelOf = section.labelOf ?? ((s: string) => s);
    for (const subtype of section.subtypes) {
      const cells: MatrixCell[] = columnAnalysis.map((col) => {
        const item = findAnalysisRow(col.rows, subtype, section.paramType);
        if (!item) return { text: '—' };
        return matrixCellFromAnalysisItem(item);
      });
      rows.push({
        label: labelOf(subtype),
        section: section.section,
        cells,
        subtype,
        paramType: section.paramType,
      });
    }
  }

  rows.push({
    label: 'Итого',
    section: 'Внешние объекты',
    total: true,
    cells: columnAnalysis.map((col) => ({
      text: col.total_cost_mln != null ? `${col.total_cost_mln} млн ₽` : '—',
    })),
  });

  return { rows, columnNames, poisByColumn };
}

export function resolvePoiColumnAnalysis(
  _poi: POI,
  live: { rows?: AnalysisRow[]; total_cost_mln?: number } | undefined
): PoiColumnAnalysis {
  if (live?.rows?.length) {
    return {
      rows: live.rows,
      total_cost_mln: live.total_cost_mln ?? null,
    };
  }
  return { rows: [], total_cost_mln: null };
}
