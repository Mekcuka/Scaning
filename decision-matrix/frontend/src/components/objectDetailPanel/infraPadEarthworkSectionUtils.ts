export function parsePositive(raw: string): number | null {
  const t = raw.trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

import { formatDemApiError } from '../../lib/demApiErrors';

/** @deprecated Prefer formatDemApiError from lib/demApiErrors */
export const formatPadDemError = formatDemApiError;

export function formatSavedAt(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleString('ru-RU');
}
