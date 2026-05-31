/** Decimal places shown in UI (status bar, forms, tables). */
export const COORD_DECIMALS = 3;

/** Round for display only (labels, formatted strings). */
export function roundCoord(value: number): number {
  const factor = 10 ** COORD_DECIMALS;
  return Math.round(value * factor) / factor;
}

export function formatCoord(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  if (!Number.isFinite(n)) return String(value);
  return n.toFixed(COORD_DECIMALS);
}

/** Parse user/API number without truncating precision. */
export function parseCoord(value: string | number): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  if (!Number.isFinite(n)) return NaN;
  return n;
}

/**
 * Persist full DB value when the form still shows the rounded display;
 * otherwise use the parsed edit (e.g. user typed a new coordinate).
 */
export function coordForSave(parsed: number, original: number, displayValue: string): number {
  if (!Number.isFinite(parsed)) return original;
  if (displayValue.trim() === formatCoord(original)) return original;
  return parsed;
}

export function formatCoordPair(lon: number, lat: number): string {
  return `${formatCoord(lat)}°N, ${formatCoord(lon)}°E`;
}
