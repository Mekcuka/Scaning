/** Sand volume keys in infrastructure object properties (logistics). */

import type { InfraObject } from './api';
import { isLineSubtype } from './infraGeometry';

export const SAND_VOLUME_INITIAL_M3 = 'sand_volume_initial_m3';
export const SAND_VOLUME_CURRENT_M3 = 'sand_volume_current_m3';
export const SAND_VOLUME_DEMAND_M3 = 'sand_volume_m3';

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
): Record<string, number> | undefined {
  if (isSandQuarrySubtype(subtype)) {
    return {
      [SAND_VOLUME_INITIAL_M3]: DEFAULT_SAND_QUARRY_VOLUME_M3,
      [SAND_VOLUME_CURRENT_M3]: DEFAULT_SAND_QUARRY_VOLUME_M3,
    };
  }
  if (pointShowsSandDemand(subtype)) {
    return { [SAND_VOLUME_DEMAND_M3]: DEFAULT_SAND_DEMAND_M3 };
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
