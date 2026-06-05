import type { SandLogisticsResult, SandLogisticsSubnet, SandLogisticsYearStep } from '../api';

/** Subnets for schematic/tables at a view date (from timeline or fallback). */
export function resolveSubnetsAtView(
  result: SandLogisticsResult,
  viewAsOf: string,
): SandLogisticsSubnet[] {
  if (!result.timeline.length) return result.subnets;
  const viewYear = Number.parseInt(viewAsOf.slice(0, 4), 10);
  const step =
    result.timeline.find((t) => t.as_of === viewAsOf) ??
    result.timeline.find((t) => t.year === viewYear);
  if (step?.subnets.length) return step.subnets;
  return result.subnets;
}

/** Timeline step for a view date, if the result has a horizon timeline. */
export function resolveViewTimelineStep(
  result: SandLogisticsResult,
  viewAsOf: string,
): SandLogisticsYearStep | null {
  if (!result.timeline.length) return null;
  const viewYear = Number.parseInt(viewAsOf.slice(0, 4), 10);
  return (
    result.timeline.find((t) => t.as_of === viewAsOf) ??
    result.timeline.find((t) => t.year === viewYear) ??
    null
  );
}

export function horizonYearRange(result: SandLogisticsResult): number[] {
  const fromYear = Number.parseInt(result.horizon_from.slice(0, 4), 10);
  const toYear = Number.parseInt(result.horizon_to.slice(0, 4), 10);
  if (!Number.isFinite(fromYear) || !Number.isFinite(toYear)) return [];
  const years: number[] = [];
  for (let y = fromYear; y <= toYear; y += 1) years.push(y);
  return years;
}

export function yearEndIso(year: number): string {
  return `${year}-12-31`;
}

export function withInfraObjectNames(
  result: SandLogisticsResult,
  infra: { id: string; name: string }[]
): SandLogisticsResult {
  const object_names = { ...result.object_names };
  for (const o of infra) {
    const trimmed = o.name?.trim();
    if (trimmed) object_names[o.id] = trimmed;
  }
  return { ...result, object_names };
}
