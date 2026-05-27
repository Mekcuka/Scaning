export const COORD_DECIMALS = 3;

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

export function parseCoord(value: string | number): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  if (!Number.isFinite(n)) return NaN;
  return roundCoord(n);
}

export function formatCoordPair(lon: number, lat: number): string {
  return `${formatCoord(lat)}°N, ${formatCoord(lon)}°E`;
}
