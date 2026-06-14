export const MAX_LENGTH = 500;
export const MAX_WIDTH = 500;
export const MIN_DIM = 1;

export function clampLength(n: number): number {
  return Math.min(MAX_LENGTH, Math.max(MIN_DIM, n));
}

export function clampWidth(n: number): number {
  return Math.min(MAX_WIDTH, Math.max(MIN_DIM, n));
}

export function clampRotation(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(180, Math.max(-180, n));
}

export function parsePositive(raw: string): number | null {
  const t = raw.trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function parseRotation(raw: string): number {
  const t = raw.trim().replace(',', '.');
  if (!t) return 0;
  const n = Number(t);
  return clampRotation(n);
}
