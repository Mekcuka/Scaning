export {
  CAPEX_RATE_GROUPS,
  COST_RATE_GROUPS,
  DISTANCE_PARAMETER_GROUPS,
  ECONOMIC_PARAM_GROUPS,
  OPEX_PARAMETER_GROUPS,
  REVENUE_PARAMETER_GROUPS,
  buildDefaultDistanceDefaults,
  buildDefaultEconomicParamsFromCatalog as buildDefaultEconomicParams,
  buildDefaultRatesFromCatalog as buildDefaultRates,
  effectiveDistanceDefaults,
  sparseNumericOverrides,
} from './parameterCatalog';

export type { DistanceParameterGroup, ParameterGroup } from './parameterCatalog';

import { buildDefaultRatesFromCatalog } from './parameterCatalog';

export { SUBTYPE_LABELS } from './api';

export function effectiveCostRate(
  rates: Record<string, number>,
  rateId: string,
  fallback = 0
): number {
  const value = rates[rateId];
  if (value != null && value !== 0) return value;
  const defaults = buildDefaultRatesFromCatalog();
  return defaults[rateId] ?? fallback;
}

export const STATUS_LABELS: Record<string, string> = {
  within_limit: 'В пределах',
  exceeds_limit: 'Превышение',
  not_required: 'Не требуется',
  construction_required: 'Строительство',
  computed: 'Расчёт',
};
