/** Paths that are not scoped under /:projectId */
export const GLOBAL_ROUTE_PREFIXES = [
  '/login',
  '/register',
  '/projects',
  '/admin',
] as const;

const GLOBAL_FIRST_SEGMENTS = new Set(['login', 'register', 'projects', 'admin']);

/** First URL segment that is an app route, not a project id (legacy URLs without prefix). */
const APP_ROUTE_SEGMENTS = new Set([
  'map',
  'pad-clustering',
  'matrix',
  'report',
  'parameters',
  'flows',
  'data',
  'rates',
  'import',
  'export',
  'import-3d',
]);

export function isGlobalAppPath(path: string): boolean {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return GLOBAL_ROUTE_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
  );
}

/** Build project-scoped path: /{projectId}/map */
export function projectPath(projectId: string, suffix = ''): string {
  if (!suffix || suffix === '/') return `/${projectId}`;
  const s = suffix.startsWith('/') ? suffix : `/${suffix}`;
  if (isGlobalAppPath(s)) return s;
  return `/${projectId}${s}`;
}

/**
 * Strip /:projectId prefix for permission checks, headers, assistant context.
 * /abc-123/map → /map, /projects → /projects, /parameters/rates → /parameters/rates
 */
export function stripProjectPrefix(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) return '/';
  if (GLOBAL_FIRST_SEGMENTS.has(parts[0])) return pathname;
  if (APP_ROUTE_SEGMENTS.has(parts[0])) return pathname;
  if (parts.length === 1) return '/';
  return `/${parts.slice(1).join('/')}`;
}

/** Extract project id from pathname, or null for global/legacy routes. */
export function projectIdFromPathname(pathname: string): string | null {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) return null;
  if (GLOBAL_FIRST_SEGMENTS.has(parts[0])) return null;
  if (APP_ROUTE_SEGMENTS.has(parts[0])) return null;
  return parts[0] ?? null;
}
