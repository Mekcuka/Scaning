import { isLineSubtype } from './infraGeometry';

/** Точечные подтипы без поля «Пропускная способность». */
export const THROUGHPUT_CAPACITY_EXCLUDED_SUBTYPES = new Set([
  'node',
  'pad',
  'sand_quarry',
  'substation',
  'vies',
  'gtes',
  'gpes',
]);

export type InfraCapacityUnit = 'thousand_t_per_year' | 'thousand_m3_per_year';

const GAS_LIKE_SUBTYPES = new Set(['gas_processing']);

export function pointShowsThroughputCapacity(subtype: string): boolean {
  if (isLineSubtype(subtype)) return false;
  return !THROUGHPUT_CAPACITY_EXCLUDED_SUBTYPES.has(subtype);
}

export function defaultCapacityUnitForSubtype(subtype: string): InfraCapacityUnit {
  return GAS_LIKE_SUBTYPES.has(subtype) ? 'thousand_m3_per_year' : 'thousand_t_per_year';
}

export function capacityUnitLabel(unit: InfraCapacityUnit | string | null | undefined): string {
  return unit === 'thousand_m3_per_year' ? 'тыс. м³/год' : 'тыс. т/год';
}

export function readThroughputCapacity(
  properties: Record<string, unknown> | undefined | null
): { value: number | null; unit: InfraCapacityUnit } {
  const props = properties ?? {};
  const raw = props.throughput_capacity_annual;
  const unit = (props.capacity_unit as InfraCapacityUnit) || 'thousand_t_per_year';
  if (raw == null || raw === '') return { value: null, unit };
  const n = typeof raw === 'number' ? raw : Number(raw);
  return { value: Number.isNaN(n) ? null : n, unit };
}

export function mergeThroughputCapacity(
  properties: Record<string, unknown> | undefined | null,
  value: number | null,
  unit: InfraCapacityUnit
): Record<string, unknown> {
  const next = { ...(properties ?? {}) };
  if (value == null) {
    delete next.throughput_capacity_annual;
    delete next.capacity_unit;
  } else {
    next.throughput_capacity_annual = value;
    next.capacity_unit = unit;
  }
  return next;
}
