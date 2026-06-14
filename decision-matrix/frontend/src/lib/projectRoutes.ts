/** Paths that are not scoped with a project id suffix */
export const GLOBAL_ROUTE_PREFIXES = [
  '/login',
  '/register',
  '/projects',
  '/admin',
] as const;

const GLOBAL_FIRST_SEGMENTS = new Set(['login', 'register', 'projects', 'admin']);

/** App route first segments (not project ids). */
const APP_ROUTE_SEGMENTS = new Set([
  'dashboard',
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

/** Project ids in URLs are UUIDs (see backend project primary keys). */
export const PROJECT_ID_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isProjectIdSegment(segment: string): boolean {
  return PROJECT_ID_UUID_RE.test(segment);
}

export function isGlobalAppPath(path: string): boolean {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return GLOBAL_ROUTE_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
  );
}

function normalizeLogicalSuffix(suffix: string): string {
  if (!suffix || suffix === '/') return '/dashboard';
  return suffix.startsWith('/') ? suffix : `/${suffix}`;
}

/** Build project-scoped path: /map/{projectId}, /parameters/rates/{projectId}, … */
export function projectPath(projectId: string, suffix = ''): string {
  const logical = normalizeLogicalSuffix(suffix);
  if (isGlobalAppPath(logical)) return logical;
  if (!projectId) {
    return logical === '/dashboard' ? '/' : logical;
  }
  if (logical === '/dashboard') return `/dashboard/${projectId}`;
  return `${logical}/${projectId}`;
}

/**
 * Strip project id for permission checks, headers, assistant context.
 * /map/{id} → /map, /dashboard/{id} → /, legacy /{id}/map → /map
 */
export function stripProjectPrefix(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) return '/';
  if (GLOBAL_FIRST_SEGMENTS.has(parts[0]!)) return pathname;

  const last = parts[parts.length - 1]!;
  if (parts.length >= 2 && isProjectIdSegment(last)) {
    const logicalParts = parts.slice(0, -1);
    if (logicalParts.length === 0 || logicalParts[0] === 'dashboard') return '/';
    return `/${logicalParts.join('/')}`;
  }

  const first = parts[0]!;
  if (isProjectIdSegment(first)) {
    if (parts.length === 1) return '/';
    return `/${parts.slice(1).join('/')}`;
  }

  if (APP_ROUTE_SEGMENTS.has(first)) return pathname;
  return pathname;
}

/** Extract project id from pathname (suffix or legacy prefix), or null. */
export function projectIdFromPathname(pathname: string): string | null {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) return null;
  if (GLOBAL_FIRST_SEGMENTS.has(parts[0]!)) return null;

  const last = parts[parts.length - 1]!;
  if (parts.length >= 2 && isProjectIdSegment(last)) return last;

  const first = parts[0]!;
  if (isProjectIdSegment(first)) return first;

  return null;
}

/** Legacy /{projectId}/… → /…/{projectId} */
export function legacyPrefixToSuffixPath(pathname: string): string | null {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) return null;
  const first = parts[0]!;
  if (!isProjectIdSegment(first)) return null;
  if (parts.length === 1) return projectPath(first);
  const rest = parts.slice(1).join('/');
  return projectPath(first, `/${rest}`);
}
