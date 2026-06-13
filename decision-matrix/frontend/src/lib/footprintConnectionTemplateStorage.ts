import type { FootprintLineConnectionTemplate } from './padFootprintLineAttach';

const STORAGE_PREFIX = 'dm-footprint-connect-template:';

function storageKey(projectId: string): string {
  return `${STORAGE_PREFIX}${projectId}`;
}

export function loadFootprintConnectionTemplate(
  projectId: string | null | undefined,
): FootprintLineConnectionTemplate {
  if (!projectId) return {};
  try {
    const raw = localStorage.getItem(storageKey(projectId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as FootprintLineConnectionTemplate;
  } catch {
    return {};
  }
}

export function saveFootprintConnectionTemplate(
  projectId: string,
  template: FootprintLineConnectionTemplate,
): void {
  try {
    if (Object.keys(template).length === 0) {
      localStorage.removeItem(storageKey(projectId));
      return;
    }
    localStorage.setItem(storageKey(projectId), JSON.stringify(template));
  } catch {
    /* localStorage unavailable */
  }
}
