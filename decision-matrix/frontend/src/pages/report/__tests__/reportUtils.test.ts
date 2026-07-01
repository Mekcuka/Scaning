import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ROADMAP,
  roadmapToGantt,
  ganttChartSpanMonths,
  ganttAxisTicks,
  statusLabel,
  statusClass,
  groupAnalysisRows,
  formatRowLine,
} from '../reportUtils';

describe('reportUtils', () => {
  it('roadmapToGantt handles open-ended stage', () => {
    const segments = roadmapToGantt(DEFAULT_ROADMAP);
    const last = segments[segments.length - 1]!;
    expect(last.isOpenEnded).toBe(true);
    expect(last.endMonth).toBeNull();
  });

  it('roadmapToGantt sequential durations when not cumulative', () => {
    const stages = [
      { stage: 'A', duration_months: 6 },
      { stage: 'B', duration_months: 3 },
    ];
    const segments = roadmapToGantt(stages);
    expect(segments[0]!.startMonth).toBe(0);
    expect(segments[0]!.endMonth).toBe(6);
    expect(segments[1]!.startMonth).toBe(6);
    expect(segments[1]!.endMonth).toBe(9);
  });

  it('roadmapToGantt cumulative milestones', () => {
    const stages = [
      { stage: 'A', duration_months: 6 },
      { stage: 'B', duration_months: 12 },
    ];
    const segments = roadmapToGantt(stages);
    expect(segments[1]!.startMonth).toBe(6);
    expect(segments[1]!.endMonth).toBe(12);
  });

  it('ganttChartSpanMonths returns at least 12', () => {
    expect(ganttChartSpanMonths([])).toBeGreaterThanOrEqual(12);
  });

  it('ganttAxisTicks produces ticks', () => {
    const ticks = ganttAxisTicks(36);
    expect(ticks[0]).toBe(0);
    expect(ticks[ticks.length - 1]).toBe(36);
  });

  it('statusLabel and statusClass', () => {
    expect(statusLabel(undefined)).toBe('—');
    expect(statusClass('exceeds_limit')).toBe('status-exceeds');
    expect(statusClass('within_limit')).toBe('status-within');
  });

  it('groupAnalysisRows splits internal and external', () => {
    const rows = [
      { subtype: 'gas_processing', param_type: 'internal' },
      { subtype: 'road', param_type: 'external' },
    ] as never[];
    const { internal, external } = groupAnalysisRows(rows);
    expect(internal).toHaveLength(1);
    expect(external).toHaveLength(1);
  });

  it('formatRowLine builds label', () => {
    const line = formatRowLine({
      subtype: 'gas_processing',
      object_name: 'Obj',
      status: 'within_limit',
      param_type: 'internal',
    } as never);
    expect(line.main).toContain('ГКС');
    expect(line.sub).toBeDefined();
  });
});
