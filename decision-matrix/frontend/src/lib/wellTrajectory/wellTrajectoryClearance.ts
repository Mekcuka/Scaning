/** Line color for well trajectory based on anti-collision SF vs threshold. */

const COLOR_OK = '#2e7d32';
const COLOR_WARN = '#c62828';
const COLOR_DEFAULT = '#1565c0';

/** Map 2D/3D: main bore (welleng survey). */
export const WELL_TRAJECTORY_MAP_MAIN_COLOR = '#1565c0';
/** Map 2D/3D: PyWellGeo lateral / side branches. */
export const WELL_TRAJECTORY_MAP_LATERAL_COLOR = '#f9a825';
/** OpenLayers lineDash for trajectory plan layers. */
export const WELL_TRAJECTORY_MAP_LINE_DASH = [8, 6] as const;

/** Distinct colors per well index (shared with pad clustering 3D). */
export const WELL_TRAJECTORY_PALETTE = [
  '#f97316',
  '#22c55e',
  '#a855f7',
  '#06b6d4',
  '#eab308',
  '#ef4444',
] as const;

export function wellTrajectoryPaletteColor(wellIndex: number): string {
  return WELL_TRAJECTORY_PALETTE[Math.abs(wellIndex) % WELL_TRAJECTORY_PALETTE.length]!;
}

export function wellTrajectoryPaletteColorHex(wellIndex: number): number {
  const hex = wellTrajectoryPaletteColor(wellIndex).replace('#', '');
  return Number.parseInt(hex, 16);
}

/** Display color: red when SF below threshold, else per-well palette. */
export function wellTrajectoryDisplayColor(
  wellIndex: number,
  minSf: number | null | undefined,
  threshold: number,
): string {
  if (minSf != null && Number.isFinite(minSf) && minSf < threshold) {
    return COLOR_WARN;
  }
  return wellTrajectoryPaletteColor(wellIndex);
}

export function wellTrajectoryDisplayColorHex(
  wellIndex: number,
  minSf: number | null | undefined,
  threshold: number,
): number {
  const hex = wellTrajectoryDisplayColor(wellIndex, minSf, threshold).replace('#', '');
  return Number.parseInt(hex, 16);
}

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
