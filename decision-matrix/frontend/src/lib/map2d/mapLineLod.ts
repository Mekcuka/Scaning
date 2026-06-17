/** Line display LOD: simplify to endpoints when map scale denominator exceeds threshold. */

export const DEFAULT_LINE_LOD_SCALE_THRESHOLD = 500_000;
export const LINE_LOD_SCALE_MIN = 50_000;
export const LINE_LOD_SCALE_MAX = 1_500_000;
export const LINE_LOD_SCALE_STEP = 25_000;

export function clampLineLodScaleThreshold(value: number): number {
  const n = Math.round(value);
  if (!Number.isFinite(n)) return DEFAULT_LINE_LOD_SCALE_THRESHOLD;
  return Math.min(LINE_LOD_SCALE_MAX, Math.max(LINE_LOD_SCALE_MIN, n));
}

export function formatScaleDenominator(scale: number): string {
  return Math.round(scale).toLocaleString('ru-RU');
}

export type LineDisplayLod = 'full' | 'endpoints';

export function lineLodForScale(scaleDenominator: number, threshold: number): LineDisplayLod {
  return scaleDenominator >= threshold ? 'endpoints' : 'full';
}
