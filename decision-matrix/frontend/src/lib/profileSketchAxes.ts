/** Axis tick helpers for profile sketch editor. */

export function niceAxisStep(span: number, targetTicks = 5): number {
  if (!Number.isFinite(span) || span <= 0) return 1;
  const raw = span / targetTicks;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  if (norm > 5) return 10 * mag;
  if (norm > 2) return 5 * mag;
  if (norm > 1) return 2 * mag;
  return mag;
}

export function axisTicks(min: number, max: number, step: number): number[] {
  if (step <= 0) return [];
  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 0.001; v += step) {
    ticks.push(Math.round(v * 1000) / 1000);
  }
  return ticks;
}

export function formatChainageM(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded)
    ? `${rounded.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}`
    : rounded.toLocaleString('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function formatProfileElevationM(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return rounded.toLocaleString('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}
