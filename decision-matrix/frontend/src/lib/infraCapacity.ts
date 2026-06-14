import { isLineSubtype } from './infraGeometry';

/** Точечные подтипы без поля «Пропускная способность». */
export const THROUGHPUT_CAPACITY_EXCLUDED_SUBTYPES = new Set([
  'node',
  'oil_pad',
  'gas_pad',
  'sand_quarry',
  'offplot',
  'additional_facility',
  'substation',
  'vies',
  'gtes',
  'gpes',
  'well_bottomhole_nnb',
  'well_bottomhole_gs',
  'well_bottomhole_gs_heel',
  'well_bottomhole_gs_toe',
]);

export type InfraCapacityUnit = 'thousand_t_per_year' | 'thousand_m3_per_year';

export type ThroughputCapacityDefault = {
  value: number;
  unit: InfraCapacityUnit;
};

/** Нормативные пропускные способности площадных объектов (тыс. т/год или тыс. м³/год). */
export const DEFAULT_THROUGHPUT_CAPACITY_BY_SUBTYPE: Record<string, ThroughputCapacityDefault> = {
  refinery: { value: 5000, unit: 'thousand_t_per_year' },
  oil_pumping_station: { value: 2500, unit: 'thousand_t_per_year' },
  gas_processing: { value: 1200, unit: 'thousand_m3_per_year' },
  ukg: { value: 1000, unit: 'thousand_m3_per_year' },
  tsg: { value: 800, unit: 'thousand_m3_per_year' },
  preliminary_water_discharge_station: { value: 800, unit: 'thousand_t_per_year' },
  booster_pumping_station: { value: 600, unit: 'thousand_t_per_year' },
  ground_pumping_station: { value: 500, unit: 'thousand_t_per_year' },
  methanol_facility: { value: 500, unit: 'thousand_t_per_year' },
  methanol_joint: { value: 300, unit: 'thousand_t_per_year' },
};

const GAS_LIKE_SUBTYPES = new Set(['gas_processing', 'ukg', 'tsg']);

export function defaultThroughputCapacityForSubtype(
  subtype: string
): ThroughputCapacityDefault | null {
  return DEFAULT_THROUGHPUT_CAPACITY_BY_SUBTYPE[subtype] ?? null;
}

export function effectiveThroughputCapacity(
  subtype: string,
  properties: Record<string, unknown> | undefined | null
): { value: number | null; unit: InfraCapacityUnit; isStored: boolean } {
  const stored = readThroughputCapacity(properties);
  if (stored.value != null) {
    return { value: stored.value, unit: stored.unit, isStored: true };
  }
  const def = defaultThroughputCapacityForSubtype(subtype);
  if (def) {
    return { value: def.value, unit: def.unit, isStored: false };
  }
  return { value: null, unit: defaultCapacityUnitForSubtype(subtype), isStored: false };
}

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

/** Persist subtype normative throughput when saving a new point from the map. */
export function withDefaultThroughputCapacity(
  subtype: string,
  properties?: Record<string, unknown>,
): Record<string, unknown> {
  if (!pointShowsThroughputCapacity(subtype)) {
    return { ...(properties ?? {}) };
  }
  if (readThroughputCapacity(properties).value != null) {
    return { ...(properties ?? {}) };
  }
  const def = defaultThroughputCapacityForSubtype(subtype);
  if (!def) {
    return { ...(properties ?? {}) };
  }
  return mergeThroughputCapacity(properties, def.value, def.unit);
}
