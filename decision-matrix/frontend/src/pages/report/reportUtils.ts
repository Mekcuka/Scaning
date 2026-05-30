import { ANALYSIS_LINE_SUBTYPES, SUBTYPE_LABELS, type AnalysisRow, type OnePagerRoadmapStage } from '../../lib/api';
import { internalMatrixCellParts } from '../../lib/matrixData';
import { STATUS_LABELS } from '../../lib/specs';

export const DEFAULT_ROADMAP = [
  { stage: 'Разведка', duration_months: 6 },
  { stage: 'Изыскания', duration_months: 12 },
  { stage: 'ПИР', duration_months: 18 },
  { stage: 'Бурение', duration_months: 24 },
  { stage: 'Строительство', duration_months: 36 },
  { stage: 'Эксплуатация', duration_months: null },
];

export type RoadmapGanttSegment = {
  index: number;
  stage: string;
  startMonth: number;
  endMonth: number | null;
  durationMonths: number | null;
  isOpenEnded: boolean;
};

/** Cumulative milestone months (6, 12, 18…) → Gantt bars. */
export function roadmapToGantt(stages: OnePagerRoadmapStage[]): RoadmapGanttSegment[] {
  const finite = stages
    .map((s) => s.duration_months)
    .filter((m): m is number => m != null && m >= 0);
  const cumulative =
    finite.length >= 2 && finite.every((m, i) => i === 0 || m >= finite[i - 1]);

  let cursor = 0;
  return stages.map((step, index) => {
    if (step.duration_months == null) {
      return {
        index,
        stage: step.stage,
        startMonth: cursor,
        endMonth: null,
        durationMonths: null,
        isOpenEnded: true,
      };
    }

    const end = step.duration_months;

    if (cumulative) {
      const start = index === 0 ? 0 : (stages[index - 1].duration_months as number);
      cursor = end;
      return {
        index,
        stage: step.stage,
        startMonth: start,
        endMonth: end,
        durationMonths: end - start,
        isOpenEnded: false,
      };
    }

    const start = cursor;
    cursor += end;
    return {
      index,
      stage: step.stage,
      startMonth: start,
      endMonth: start + end,
      durationMonths: end,
      isOpenEnded: false,
    };
  });
}

export function ganttChartSpanMonths(segments: RoadmapGanttSegment[]): number {
  const finiteEnds = segments
    .map((s) => s.endMonth)
    .filter((m): m is number => m != null);
  const maxEnd = finiteEnds.length ? Math.max(...finiteEnds) : 36;
  return Math.max(maxEnd, 12);
}

export function ganttAxisTicks(spanMonths: number): number[] {
  const step = spanMonths <= 24 ? 6 : spanMonths <= 48 ? 12 : 24;
  const ticks: number[] = [0];
  for (let m = step; m < spanMonths; m += step) ticks.push(m);
  ticks.push(spanMonths);
  return ticks;
}

export function statusLabel(status: string | undefined): string {
  if (!status) return '—';
  return STATUS_LABELS[status as keyof typeof STATUS_LABELS] ?? status;
}

export function statusClass(status: string | undefined): string {
  if (status === 'exceeds_limit') return 'status-exceeds';
  if (status === 'construction_required') return 'status-construction';
  if (status === 'within_limit' || status === 'computed') return 'status-within';
  if (status === 'not_required') return 'status-muted';
  return '';
}

export function groupAnalysisRows(rows: AnalysisRow[]) {
  const internal = rows.filter(
    (r) => r.param_type === 'internal' || ANALYSIS_LINE_SUBTYPES.includes(r.subtype as typeof ANALYSIS_LINE_SUBTYPES[number]) || r.subtype === 'pads'
  );
  const external = rows.filter((r) => r.param_type === 'external' || r.param_type === 'external_linear');
  return { internal, external };
}

export function formatRowLine(row: AnalysisRow): { main: string; sub?: string } {
  const label = SUBTYPE_LABELS[row.subtype] ?? row.subtype;
  const parts = internalMatrixCellParts(row as unknown as Record<string, unknown>);
  const name = row.object_name ? ` · ${row.object_name}` : '';
  return {
    main: `${label}${name}`,
    sub: `${parts.subtext ? `${parts.subtext} · ` : ''}${parts.text} · ${statusLabel(row.status)}`,
  };
}
