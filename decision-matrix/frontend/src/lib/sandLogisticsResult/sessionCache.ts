import type { SandLogisticsResult } from '../api';
import { normalizeSandLogisticsResult } from './normalize';

export function sandLogisticsStorageKey(projectId: string): string {
  return `sand-logistics:${projectId}`;
}

/** Browser-tab cache of last result (mirrors React Query; survives F5 in the same tab). */
export function sandLogisticsSessionCacheKey(projectId: string): string {
  return `sand-logistics-cache:${projectId}`;
}

export function saveSandLogisticsSessionCache(
  projectId: string,
  result: SandLogisticsResult,
): void {
  try {
    sessionStorage.setItem(
      sandLogisticsSessionCacheKey(projectId),
      JSON.stringify(result),
    );
  } catch {
    /* quota or private mode */
  }
}

export function loadSandLogisticsSessionCache(projectId: string): SandLogisticsResult | null {
  try {
    const raw = sessionStorage.getItem(sandLogisticsSessionCacheKey(projectId));
    if (!raw) return null;
    return normalizeSandLogisticsResult(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function clearSandLogisticsSessionCache(projectId: string): void {
  try {
    sessionStorage.removeItem(sandLogisticsSessionCacheKey(projectId));
  } catch {
    /* ignore */
  }
}

/** Legacy sessionStorage payload (pre-DB persist); for migration banner only. */
export function hasLegacySandLogisticsSession(projectId: string): boolean {
  try {
    return sessionStorage.getItem(sandLogisticsStorageKey(projectId)) != null;
  } catch {
    return false;
  }
}

export function clearLegacySandLogisticsSession(projectId: string): void {
  try {
    sessionStorage.removeItem(sandLogisticsStorageKey(projectId));
  } catch {
    /* ignore */
  }
}
