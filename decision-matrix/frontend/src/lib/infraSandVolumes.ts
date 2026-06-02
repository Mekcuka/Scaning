/** Sand volume keys in infrastructure object properties (logistics). */

import type { InfraObject } from './api';
import { isInService, readEntryDateIso } from './infraEntryDate';
import { isLineSubtype } from './infraGeometry';

export const SAND_VOLUME_INITIAL_M3 = 'sand_volume_initial_m3';
export const SAND_VOLUME_CURRENT_M3 = 'sand_volume_current_m3';
export const SAND_VOLUME_DEMAND_M3 = 'sand_volume_m3';
export const SAND_VOLUME_BY_YEAR = 'sand_volume_by_year';
export const SAND_VOLUME_MODE = 'sand_volume_mode';

export type SandVolumeInputMode = 'single' | 'yearly';

export const SAND_VOLUME_INPUT_MODE_OPTIONS: {
  value: SandVolumeInputMode;
  label: string;
}[] = [
  { value: 'single', label: 'Объём на дату ввода' },
  { value: 'yearly', label: 'План по годам' },
];

/** Defaults on create (mirror backend sand_properties.py). */
export const DEFAULT_SAND_DEMAND_M3 = 1000;
export const DEFAULT_SAND_QUARRY_VOLUME_M3 = 10_000;

const DEMAND_EXCLUDED = new Set(['node', 'sand_quarry']);

export function isSandConsumerSubtype(subtype: string): boolean {
  return !DEMAND_EXCLUDED.has(subtype);
}

export function isSandQuarrySubtype(subtype: string): boolean {
  return subtype === 'sand_quarry';
}

/** Точечные объекты с полем «Объём песка (спрос)» на вкладке Параметры. */
export function pointShowsSandDemand(subtype: string): boolean {
  if (isLineSubtype(subtype)) return false;
  return isSandConsumerSubtype(subtype);
}

/** Точечный объект инфраструктуры с полем спроса на песок (карта, параметры, плечо возки). */
export function infraObjectShowsSandDemand(obj: Pick<InfraObject, 'subtype'>): boolean {
  return pointShowsSandDemand(obj.subtype);
}

function parseNum(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function readQuarryVolumes(properties: Record<string, unknown> | null | undefined): {
  initial: number;
  current: number;
} {
  const props = properties ?? {};
  const initial = parseNum(props[SAND_VOLUME_INITIAL_M3]) ?? 0;
  const current = parseNum(props[SAND_VOLUME_CURRENT_M3]) ?? initial;
  return { initial, current };
}

export function readSandDemandM3(properties: Record<string, unknown> | null | undefined): number {
  return parseNum(properties?.[SAND_VOLUME_DEMAND_M3]) ?? 0;
}

export function readSandVolumeByYear(
  properties: Record<string, unknown> | null | undefined,
): Record<string, number> {
  const raw = properties?.[SAND_VOLUME_BY_YEAR];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    const year = String(key).trim();
    if (!/^\d{4}$/.test(year)) continue;
    const n = parseNum(val);
    if (n != null && n > 0) out[year] = n;
  }
  return out;
}

export function readSandVolumeInputMode(
  properties: Record<string, unknown> | null | undefined,
): SandVolumeInputMode {
  const raw = properties?.[SAND_VOLUME_MODE];
  if (raw === 'yearly' || raw === 'single') return raw;
  const plan = readSandVolumeByYear(properties);
  return Object.keys(plan).length > 0 ? 'yearly' : 'single';
}

export function sandDemandPlanTotalM3(
  properties: Record<string, unknown> | null | undefined,
): number {
  const mode = readSandVolumeInputMode(properties);
  if (mode === 'yearly') {
    const plan = readSandVolumeByYear(properties);
    return Object.values(plan).reduce((sum, v) => sum + v, 0);
  }
  return readSandDemandM3(properties);
}

function yearEndIso(year: number): string {
  return `${year}-12-31`;
}

export function demandIncrementForYear(
  properties: Record<string, unknown> | null | undefined,
  entryIso: string,
  year: number,
): number {
  const yearEnd = yearEndIso(year);
  if (!isInService(entryIso, yearEnd)) return 0;
  const mode = readSandVolumeInputMode(properties);
  if (mode === 'yearly') {
    return readSandVolumeByYear(properties)[String(year)] ?? 0;
  }
  const entryYear = Number.parseInt(entryIso.slice(0, 4), 10);
  if (year === entryYear) return readSandDemandM3(properties);
  return 0;
}

export type HorizonBounds = { horizonFrom: string; horizonTo: string };

export function computeHorizonBoundsFromInfra(
  objects: Pick<InfraObject, 'subtype' | 'properties'>[],
): HorizonBounds {
  const entryDates: string[] = [];
  const planYears: number[] = [];
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  for (const obj of objects) {
    if (obj.subtype === 'node') continue;
    if (isLineSubtype(obj.subtype) || obj.subtype === 'autoroad') {
      entryDates.push(readEntryDateIso(obj.properties));
      continue;
    }
    if (isSandQuarrySubtype(obj.subtype) || pointShowsSandDemand(obj.subtype)) {
      entryDates.push(readEntryDateIso(obj.properties));
    }
    if (pointShowsSandDemand(obj.subtype)) {
      const plan = readSandVolumeByYear(obj.properties);
      for (const y of Object.keys(plan)) {
        const n = Number.parseInt(y, 10);
        if (Number.isFinite(n)) planYears.push(n);
      }
    }
  }

  if (entryDates.length === 0) {
    return { horizonFrom: todayIso, horizonTo: todayIso };
  }
  const sorted = [...entryDates].sort();
  const horizonFrom = sorted[0]!;
  const maxEntry = sorted[sorted.length - 1]!;
  const maxEntryYear = Number.parseInt(maxEntry.slice(0, 4), 10);
  const maxPlanYear = planYears.length > 0 ? Math.max(...planYears) : maxEntryYear;
  const endYear = Math.max(maxEntryYear, maxPlanYear);
  return { horizonFrom, horizonTo: yearEndIso(endYear) };
}

export function effectiveSandDemandM3(
  properties: Record<string, unknown> | null | undefined,
  entryIso: string,
  asOfIso: string,
): { effective: number; planTotal: number; breakdown: Record<string, number> } {
  const mode = readSandVolumeInputMode(properties);
  const plan = readSandVolumeByYear(properties);
  const planKeys = Object.keys(plan);
  const planTotal =
    mode === 'yearly'
      ? Object.values(plan).reduce((sum, v) => sum + v, 0)
      : readSandDemandM3(properties);

  if (mode === 'yearly' && planKeys.length > 0) {
    const entryYear = Number.parseInt(entryIso.slice(0, 4), 10);
    const asOfYear = Number.parseInt(asOfIso.slice(0, 4), 10);
    const breakdown: Record<string, number> = {};
    let effective = 0;
    for (let y = entryYear; y <= asOfYear; y += 1) {
      const yearKey = String(y);
      const vol = plan[yearKey] ?? 0;
      if (vol <= 0) continue;
      const yearAsOf = asOfIso < yearEndIso(y) ? asOfIso : yearEndIso(y);
      if (isInService(entryIso, yearAsOf)) {
        breakdown[yearKey] = vol;
        effective += vol;
      }
    }
    return { effective, planTotal, breakdown };
  }

  if (isInService(entryIso, asOfIso)) {
    const demand = readSandDemandM3(properties);
    return { effective: demand, planTotal: demand, breakdown: {} };
  }

  const fallback = readSandDemandM3(properties);
  return { effective: 0, planTotal: fallback, breakdown: {} };
}

export function effectiveSandDemandForObject(
  obj: Pick<InfraObject, 'properties'>,
  asOfIso: string,
): number {
  const entryIso = readEntryDateIso(obj.properties);
  return effectiveSandDemandM3(obj.properties, entryIso, asOfIso).effective;
}

export function mergeSandVolumeByYear(
  properties: Record<string, unknown> | null | undefined,
  plan: Record<string, number> | null,
): Record<string, unknown> {
  const next = { ...(properties ?? {}) };
  if (!plan || Object.keys(plan).length === 0) {
    delete next[SAND_VOLUME_BY_YEAR];
    return next;
  }
  const cleaned: Record<string, number> = {};
  for (const [year, vol] of Object.entries(plan)) {
    if (!/^\d{4}$/.test(year)) continue;
    const n = parseNum(vol);
    if (n != null && n > 0) cleaned[year] = n;
  }
  if (Object.keys(cleaned).length === 0) {
    delete next[SAND_VOLUME_BY_YEAR];
  } else {
    next[SAND_VOLUME_BY_YEAR] = cleaned;
  }
  return next;
}

export function mergeSandVolumeInputMode(
  properties: Record<string, unknown> | null | undefined,
  mode: SandVolumeInputMode,
): Record<string, unknown> {
  return { ...(properties ?? {}), [SAND_VOLUME_MODE]: mode };
}

/** Persist sand demand using the selected input mode; clears the alternate storage. */
export function mergeSandVolumeForSave(
  properties: Record<string, unknown> | null | undefined,
  mode: SandVolumeInputMode,
  singleDemand: number | null,
  yearPlan: Record<string, number>,
): Record<string, unknown> {
  let next = mergeSandVolumeInputMode(properties, mode);
  if (mode === 'single') {
    next = mergeSandDemandM3(next, singleDemand);
    next = mergeSandVolumeByYear(next, null);
  } else {
    next = mergeSandVolumeByYear(next, yearPlan);
    next = mergeSandDemandM3(next, null);
  }
  return next;
}

export function mergeQuarryVolumes(
  properties: Record<string, unknown> | null | undefined,
  initial: number | null,
  current: number | null
): Record<string, unknown> {
  const next = { ...(properties ?? {}) };
  if (initial == null) delete next[SAND_VOLUME_INITIAL_M3];
  else next[SAND_VOLUME_INITIAL_M3] = initial;
  if (current == null) delete next[SAND_VOLUME_CURRENT_M3];
  else next[SAND_VOLUME_CURRENT_M3] = current;
  return next;
}

export function mergeSandDemandM3(
  properties: Record<string, unknown> | null | undefined,
  demand: number | null
): Record<string, unknown> {
  const next = { ...(properties ?? {}) };
  if (demand == null || demand === 0) delete next[SAND_VOLUME_DEMAND_M3];
  else next[SAND_VOLUME_DEMAND_M3] = demand;
  return next;
}

/** Defaults for create payload (backend also applies if omitted). */
export function defaultSandPropertiesForSubtype(
  subtype: string
): Record<string, unknown> | undefined {
  if (isSandQuarrySubtype(subtype)) {
    return {
      [SAND_VOLUME_INITIAL_M3]: DEFAULT_SAND_QUARRY_VOLUME_M3,
      [SAND_VOLUME_CURRENT_M3]: DEFAULT_SAND_QUARRY_VOLUME_M3,
    };
  }
  if (pointShowsSandDemand(subtype)) {
    return {
      [SAND_VOLUME_DEMAND_M3]: DEFAULT_SAND_DEMAND_M3,
      [SAND_VOLUME_MODE]: 'single' satisfies SandVolumeInputMode,
    };
  }
  return undefined;
}

export function withDefaultSandProperties(
  subtype: string,
  properties?: Record<string, unknown> | null
): Record<string, unknown> {
  const defaults = defaultSandPropertiesForSubtype(subtype);
  if (!defaults) return { ...(properties ?? {}) };
  return { ...defaults, ...(properties ?? {}) };
}
