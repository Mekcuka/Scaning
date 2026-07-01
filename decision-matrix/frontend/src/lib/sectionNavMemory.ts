/**
 * Remember last visited sub-route within main nav sections (Параметры / Потоки / Данные / Админ).
 * Used so sidebar clicks return to the same sub-tab, not the section default.
 */

import { projectPath, stripProjectPrefix } from './projectRoutes';

export type NavSection = 'parameters' | 'logistics' | 'flows' | 'admin' | 'data' | 'pad-clustering';

const SECTION_PREFIX: Record<NavSection, string> = {
  parameters: '/parameters',
  logistics: '/logistics',
  flows: '/flows',
  admin: '/admin',
  data: '/data',
  'pad-clustering': '/pad-clustering',
};

const SECTION_DEFAULT: Record<NavSection, string> = {
  parameters: '/parameters/capacity',
  logistics: '/logistics/schematic',
  flows: '/flows/technology',
  admin: '/admin/users',
  data: '/data/export',
  'pad-clustering': '/pad-clustering/workspace',
};

const ALLOWED_PATHS: Record<NavSection, readonly string[]> = {
  parameters: [
    '/parameters/capacity',
    '/parameters/earthwork',
    '/parameters/footprint-connections',
    '/parameters/entry-dates',
    '/parameters/rates',
  ],
  logistics: ['/logistics/sand', '/logistics/schematic'],
  flows: ['/flows/technology', '/flows/economic'],
  admin: ['/admin/users', '/admin/jobs', '/admin/assistant'],
  data: ['/data/import', '/data/export', '/data/import-3d'],
  'pad-clustering': [
    '/pad-clustering/workspace',
    '/pad-clustering/summary',
    '/pad-clustering/profile',
  ],
};

const LEGACY_PATH_MIGRATIONS: Record<string, string> = {
  '/parameters/sand': '/logistics/sand',
  '/flows/logistics': '/logistics/schematic',
};

const STORAGE_KEY = 'dm-nav-last-section';

function storageKey(section: NavSection): string {
  return `${STORAGE_KEY}:${section}`;
}

export function pathBelongsToSection(pathname: string, section: NavSection): boolean {
  const logical = stripProjectPrefix(pathname);
  const prefix = SECTION_PREFIX[section];
  return logical === prefix || logical.startsWith(`${prefix}/`);
}

function migrateLegacyNavPath(pathname: string): string {
  return LEGACY_PATH_MIGRATIONS[pathname] ?? pathname;
}

function isAllowedSectionPath(pathname: string, section: NavSection): boolean {
  const migrated = migrateLegacyNavPath(pathname);
  return (ALLOWED_PATHS[section] as readonly string[]).includes(migrated);
}

/** Persist sub-route when user navigates inside a section. */
export function rememberSectionFromPath(pathname: string): void {
  const logical = migrateLegacyNavPath(stripProjectPrefix(pathname));
  for (const section of Object.keys(SECTION_PREFIX) as NavSection[]) {
    const prefix = SECTION_PREFIX[section];
    if (logical !== prefix && pathBelongsToSection(logical, section)) {
      if (isAllowedSectionPath(logical, section)) {
        try {
          sessionStorage.setItem(storageKey(section), logical);
        } catch {
          /* sessionStorage unavailable */
        }
      }
    }
  }
}

/** Last sub-route for section, or default if none saved. */
export function getLastSectionPath(section: NavSection): string {
  try {
    const saved = sessionStorage.getItem(storageKey(section));
    if (saved) {
      const migrated = migrateLegacyNavPath(saved);
      if (isAllowedSectionPath(migrated, section)) {
        return migrated;
      }
    }
  } catch {
    /* ignore */
  }
  return SECTION_DEFAULT[section];
}

/** Saved sub-route only (no default) — for index redirect before POI heuristic. */
export function getSavedSectionPath(section: NavSection): string | null {
  try {
    const saved = sessionStorage.getItem(storageKey(section));
    if (saved) {
      const migrated = migrateLegacyNavPath(saved);
      if (isAllowedSectionPath(migrated, section)) {
        return migrated;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function navLinkTargetForSection(section: NavSection, projectId?: string | null): string {
  const logical = getLastSectionPath(section);
  if (!projectId) return logical;
  return projectPath(projectId, logical);
}

/** Sub-route relative to section parent (capacity, import, technology, …). */
export function sectionRelativePath(section: NavSection): string {
  const full = getLastSectionPath(section);
  const prefix = SECTION_PREFIX[section];
  if (full.startsWith(`${prefix}/`)) {
    return full.slice(prefix.length + 1);
  }
  return SECTION_DEFAULT[section].slice(prefix.length + 1);
}
