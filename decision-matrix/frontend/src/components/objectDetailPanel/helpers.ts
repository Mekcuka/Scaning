import type { InfraObject } from '../../lib/api';
import {
  readSandDemandM3,
  readSandVolumeByYear,
  readSandVolumeInputMode,
  type SandVolumeInputMode,
} from '../../lib/infraSandVolumes';
import {
  effectiveThroughputCapacity,
} from '../../lib/infraCapacity';
import type { PoiFormValues } from '../../lib/poiParams';
import { sandVolumeYearPlanDirty } from '../logistics/SandVolumeYearPlanEditor';

export function sandDemandFieldsDirty(
  properties: Record<string, unknown> | null | undefined,
  draft: {
    mode: SandVolumeInputMode;
    singleDemand: string;
    yearPlan: Record<string, number>;
  },
): boolean {
  if (draft.mode !== readSandVolumeInputMode(properties)) return true;
  if (draft.mode === 'yearly') {
    return sandVolumeYearPlanDirty(draft.yearPlan, readSandVolumeByYear(properties));
  }
  const saved = readSandDemandM3(properties);
  const savedStr = saved > 0 ? String(saved) : '';
  return draft.singleDemand !== savedStr;
}

export function pickPoiFields(v: PoiFormValues, keys: (keyof PoiFormValues)[]): Partial<PoiFormValues> {
  return Object.fromEntries(keys.map((key) => [key, v[key]])) as Partial<PoiFormValues>;
}

export function capacityDraftFromObject(object: InfraObject): number | '' {
  const eff = effectiveThroughputCapacity(object.subtype, object.properties);
  return eff.value != null ? eff.value : '';
}
