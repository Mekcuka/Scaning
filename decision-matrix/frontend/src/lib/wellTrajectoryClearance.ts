/** Line color for well trajectory based on anti-collision SF vs threshold. */

const COLOR_OK = '#2e7d32';
const COLOR_WARN = '#c62828';
const COLOR_DEFAULT = '#1565c0';

export function clearanceLineColor(
  minSf: number | null | undefined,
  threshold: number,
): string {
  if (minSf == null || !Number.isFinite(minSf)) {
    return COLOR_DEFAULT;
  }
  return minSf < threshold ? COLOR_WARN : COLOR_OK;
}

export function clearanceLineColorHex(
  minSf: number | null | undefined,
  threshold: number,
): number {
  const hex = clearanceLineColor(minSf, threshold).replace('#', '');
  return Number.parseInt(hex, 16);
}

export function formatMinSf(minSf: number | null | undefined, digits = 2): string {
  if (minSf == null || !Number.isFinite(minSf)) return '—';
  return minSf.toFixed(digits);
}
