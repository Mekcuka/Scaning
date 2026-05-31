import type { Project } from './api';

/** React Query may yield `null` for `data`; default `= []` only applies to `undefined`. */
export function normalizeProjectsList(data: Project[] | null | undefined): Project[] {
  return Array.isArray(data) ? data : [];
}
