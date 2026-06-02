import { formatEntryDateRu, isInService } from './infraEntryDate';
import type { SandFlowNodeKind } from './sandLogisticsFlow';

export type SandConsumerNodeStatus =
  | 'future'
  | 'met'
  | 'partial'
  | 'unallocated'
  | 'planPartialOnDate';

export type SandQuarryNodeStatus = 'future' | 'active';

export type SandNodeStatus = SandConsumerNodeStatus | SandQuarryNodeStatus;

export type SandNodeVisualInput = {
  kind: SandFlowNodeKind;
  in_service?: boolean;
  allocated_m3?: number;
  demand_m3?: number;
  demand_plan_total_m3?: number;
  /** Карьер: остаток на дату среза (greedy_remaining_m3). */
  remaining_m3?: number;
  /** Карьер: начальный объём (initial_m3). */
  initial_m3?: number;
  entry_date?: string;
  as_of?: string;
};

export type SandNodeChrome = {
  border: string;
  bg: string;
  borderStyle: 'solid' | 'dashed';
  opacity: number;
  volumeClass: string;
};

export function resolveSandConsumerNodeStatus(
  input: Omit<SandNodeVisualInput, 'kind'>,
): SandConsumerNodeStatus {
  if (input.in_service === false) return 'future';

  const demand = input.demand_m3 ?? 0;
  const allocated = input.allocated_m3 ?? 0;
  const planTotal = input.demand_plan_total_m3 ?? demand;
  const hasPlanPartial = planTotal > demand + 1e-6;

  if (demand <= 0) {
    return hasPlanPartial ? 'planPartialOnDate' : 'met';
  }
  if (allocated >= demand - 1e-6) {
    return hasPlanPartial ? 'planPartialOnDate' : 'met';
  }
  if (allocated > 1e-6) {
    return hasPlanPartial ? 'planPartialOnDate' : 'partial';
  }
  return hasPlanPartial ? 'planPartialOnDate' : 'unallocated';
}

export function resolveSandQuarryNodeStatus(input: {
  in_service?: boolean;
  entry_date?: string;
  as_of?: string;
}): SandQuarryNodeStatus {
  if (input.in_service === false) return 'future';
  if (input.as_of && input.entry_date && !isInService(input.entry_date, input.as_of)) {
    return 'future';
  }
  return 'active';
}

export function resolveSandNodeStatus(input: SandNodeVisualInput): SandNodeStatus {
  if (input.kind === 'quarry') return resolveSandQuarryNodeStatus(input);
  return resolveSandConsumerNodeStatus(input);
}

export function shouldShowEntryDateOnNode(input: SandNodeVisualInput): boolean {
  if (input.in_service === false) return true;
  if (input.kind === 'quarry' && input.as_of && input.entry_date) {
    return !isInService(input.entry_date, input.as_of);
  }
  return false;
}

export function entryDateLine(input: SandNodeVisualInput): string | null {
  if (!shouldShowEntryDateOnNode(input) || !input.entry_date) return null;
  return `ввод ${formatEntryDateRu(input.entry_date)}`;
}

export function nodeTooltipTitle(input: SandNodeVisualInput, coords?: string): string {
  const parts: string[] = [];
  if (coords) parts.push(coords);
  if (input.entry_date) parts.push(`Ввод: ${formatEntryDateRu(input.entry_date)}`);
  if (input.as_of) parts.push(`Срез: ${formatEntryDateRu(input.as_of)}`);
  return parts.join(' · ');
}

function fmtM3(value: number): string {
  return `${value.toLocaleString('ru-RU')} м³`;
}

export function consumerVolumeLines(
  status: SandConsumerNodeStatus,
  data: Pick<
    SandNodeVisualInput,
    'demand_m3' | 'allocated_m3' | 'demand_plan_total_m3'
  >,
): string[] {
  const demand = data.demand_m3 ?? 0;
  const allocated = data.allocated_m3 ?? 0;
  const planTotal = data.demand_plan_total_m3 ?? demand;

  if (status === 'future') {
    const plan = planTotal > 0 ? planTotal : demand;
    return plan > 0 ? [`план ${fmtM3(plan)}`] : [];
  }

  const lines: string[] = [];
  if (demand > 0 || allocated > 0) {
    let line = `${allocated.toLocaleString('ru-RU')} / ${demand.toLocaleString('ru-RU')} м³`;
    if (status === 'planPartialOnDate') line += ' на дату';
    if (status === 'unallocated') line += ' · нет отгрузки';
    lines.push(line);
  }

  if (status === 'planPartialOnDate' && planTotal > demand + 1e-6) {
    lines.push(`Σ ${planTotal.toLocaleString('ru-RU')} м³ плана`);
  }

  return lines;
}

/** Остаток / общий на дату среза — только числа, без подписей и единиц. */
export function quarryVolumeLines(
  status: SandQuarryNodeStatus,
  data: Pick<SandNodeVisualInput, 'remaining_m3' | 'initial_m3'>,
): string[] {
  const initial = data.initial_m3 ?? 0;
  if (initial <= 0) return [];

  if (status === 'future') {
    return [`— / ${initial.toLocaleString('ru-RU')}`];
  }

  const remaining = data.remaining_m3 ?? initial;
  return [`${remaining.toLocaleString('ru-RU')} / ${initial.toLocaleString('ru-RU')}`];
}

function consumerAllocationTone(
  status: SandConsumerNodeStatus,
  data?: Pick<SandNodeVisualInput, 'demand_m3' | 'allocated_m3'>,
): 'met' | 'partial' | 'unallocated' {
  if (status === 'future') return 'unallocated';
  const demand = data?.demand_m3 ?? 0;
  const allocated = data?.allocated_m3 ?? 0;
  if (demand <= 0 || allocated >= demand - 1e-6) return 'met';
  if (allocated > 1e-6) return 'partial';
  return 'unallocated';
}

export function nodeChromeForStatus(
  status: SandNodeStatus,
  kind: SandFlowNodeKind,
  data?: Pick<SandNodeVisualInput, 'demand_m3' | 'allocated_m3'>,
): SandNodeChrome {
  if (status === 'future') {
    return {
      border: '#94a3b8',
      bg: '#f1f5f9',
      borderStyle: 'dashed',
      opacity: 0.85,
      volumeClass: 'text-slate-600',
    };
  }

  if (kind === 'quarry') {
    return {
      border: '#d97706',
      bg: '#fffbeb',
      borderStyle: 'solid',
      opacity: 1,
      volumeClass: 'text-amber-800',
    };
  }

  if (status === 'planPartialOnDate' && data) {
    const demand = data.demand_m3 ?? 0;
    const allocated = data.allocated_m3 ?? 0;
    if (demand <= 0 || allocated >= demand - 1e-6) {
      return {
        border: '#16a34a',
        bg: '#f0fdf4',
        borderStyle: 'solid',
        opacity: 1,
        volumeClass: 'text-green-700',
      };
    }
    if (allocated > 1e-6) {
      return {
        border: '#ca8a04',
        bg: '#fefce8',
        borderStyle: 'solid',
        opacity: 1,
        volumeClass: 'text-amber-700',
      };
    }
    return {
      border: '#ea580c',
      bg: '#fff7ed',
      borderStyle: 'solid',
      opacity: 1,
      volumeClass: 'text-orange-700',
    };
  }

  const tone = consumerAllocationTone(status as SandConsumerNodeStatus, data);
  if (tone === 'met') {
    return {
      border: '#16a34a',
      bg: '#f0fdf4',
      borderStyle: 'solid',
      opacity: 1,
      volumeClass: 'text-green-700',
    };
  }
  if (tone === 'partial') {
    return {
      border: '#ca8a04',
      bg: '#fefce8',
      borderStyle: 'solid',
      opacity: 1,
      volumeClass: 'text-amber-700',
    };
  }
  return {
    border: '#ea580c',
    bg: '#fff7ed',
    borderStyle: 'solid',
    opacity: 1,
    volumeClass: 'text-orange-700',
  };
}

/** Distinct lane colors for entry-year legend chips. */
export const ENTRY_YEAR_LANE_COLORS = [
  '#6366f1',
  '#0891b2',
  '#059669',
  '#d97706',
  '#db2777',
  '#7c3aed',
];

export function entryYearFromIso(iso: string | undefined): number | null {
  if (!iso) return null;
  const y = Number.parseInt(iso.slice(0, 4), 10);
  return Number.isFinite(y) ? y : null;
}
