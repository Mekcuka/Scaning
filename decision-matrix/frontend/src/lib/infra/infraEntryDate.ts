/** Commissioning date (Дата ввода) in infrastructure object properties. */

import { withDefaultSandProperties } from '../infraSandVolumes';

export const ENTRY_DATE_KEY = 'entry_date';
export const DEFAULT_ENTRY_DATE_ISO = '2020-01-01';

export function objectShowsEntryDate(subtype: string): boolean {
  return subtype !== 'node';
}

export function parseEntryDateIso(raw: unknown): string | null {
  if (raw == null || raw === '') return null;
  const text = String(raw).trim();
  if (!text) return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(text);
  return m ? m[1]! : null;
}

export function readEntryDateIso(
  properties: Record<string, unknown> | null | undefined
): string {
  return parseEntryDateIso(properties?.[ENTRY_DATE_KEY]) ?? DEFAULT_ENTRY_DATE_ISO;
}

export function isInService(entryIso: string, asOfIso: string): boolean {
  return entryIso <= asOfIso;
}

export function todayIsoLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatEntryDateRu(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}

export function mergeEntryDate(
  properties: Record<string, unknown> | null | undefined,
  iso: string | null
): Record<string, unknown> {
  const next = { ...(properties ?? {}) };
  if (iso == null || iso === '') delete next[ENTRY_DATE_KEY];
  else next[ENTRY_DATE_KEY] = iso;
  return next;
}

export function withDefaultEntryDate(
  subtype: string,
  properties?: Record<string, unknown> | null
): Record<string, unknown> {
  if (!objectShowsEntryDate(subtype)) return { ...(properties ?? {}) };
  const next = { ...(properties ?? {}) };
  if (next[ENTRY_DATE_KEY] == null || next[ENTRY_DATE_KEY] === '') {
    next[ENTRY_DATE_KEY] = DEFAULT_ENTRY_DATE_ISO;
  }
  return next;
}

export function withDefaultInfraProperties(
  subtype: string,
  properties?: Record<string, unknown> | null
): Record<string, unknown> {
  return withDefaultEntryDate(subtype, withDefaultSandProperties(subtype, properties));
}
