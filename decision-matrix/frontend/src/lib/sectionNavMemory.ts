/**
 * Remember last visited sub-route within main nav sections (Параметры / Потоки / Админ).
 * Used so sidebar clicks return to the same sub-tab, not the section default.
 */

export type NavSection = 'parameters' | 'flows' | 'admin';

const SECTION_PREFIX: Record<NavSection, string> = {
  parameters: '/parameters',
  flows: '/flows',
  admin: '/admin',
};

const SECTION_DEFAULT: Record<NavSection, string> = {
  parameters: '/parameters/capacity',
  flows: '/flows/technology',
  admin: '/admin/users',
};

const ALLOWED_PATHS: Record<NavSection, readonly string[]> = {
  parameters: [
    '/parameters/capacity',
    '/parameters/sand',
    '/parameters/entry-dates',
    '/parameters/rates',
  ],
  flows: ['/flows/technology', '/flows/economic', '/flows/logistics'],
  admin: ['/admin/users', '/admin/jobs', '/admin/assistant'],
};

const STORAGE_KEY = 'dm-nav-last-section';

function storageKey(section: NavSection): string {
  return `${STORAGE_KEY}:${section}`;
}

export function pathBelongsToSection(pathname: string, section: NavSection): boolean {
  const prefix = SECTION_PREFIX[section];
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isAllowedSectionPath(pathname: string, section: NavSection): boolean {
  return (ALLOWED_PATHS[section] as readonly string[]).includes(pathname);
}

/** Persist sub-route when user navigates inside a section. */
export function rememberSectionFromPath(pathname: string): void {
  for (const section of Object.keys(SECTION_PREFIX) as NavSection[]) {
    const prefix = SECTION_PREFIX[section];
    if (pathname !== prefix && pathBelongsToSection(pathname, section)) {
      if (isAllowedSectionPath(pathname, section)) {
        try {
          sessionStorage.setItem(storageKey(section), pathname);
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
    if (saved && isAllowedSectionPath(saved, section)) {
      return saved;
    }
  } catch {
    /* ignore */
  }
  return SECTION_DEFAULT[section];
}

/** Saved flows path only (no default) — for index redirect before POI heuristic. */
export function getSavedSectionPath(section: NavSection): string | null {
  try {
    const saved = sessionStorage.getItem(storageKey(section));
    if (saved && isAllowedSectionPath(saved, section)) {
      return saved;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function navLinkTargetForSection(section: NavSection): string {
  return getLastSectionPath(section);
}
