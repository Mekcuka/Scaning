const PROJECT_ID_RE = /\/projects\/([^/]+)/;

export function extractProjectIdFromPath(path: string): string | null {
  const m = path.match(PROJECT_ID_RE);
  return m?.[1] ?? null;
}

/** POST/PUT/PATCH paths that represent calculations or job enqueue. */
export function shouldLogHttpPath(path: string, method: string): boolean {
  const m = method.toUpperCase();
  if (m !== 'POST' && m !== 'PUT' && m !== 'PATCH') return false;
  if (/\/autoroad-network\//.test(path)) return true;
  if (/\/pad-placement\//.test(path)) return true;
  if (/\/infrastructure\/autoroad-connect/.test(path)) return true;
  if (/\/sand-logistics\/analyze/.test(path)) return true;
  if (/\/infrastructure\/line-elevation-profile\/compute/.test(path)) return true;
  if (/\/pois\/analyze-all/.test(path)) return true;
  if (/\/pois\/[^/]+\/analyze/.test(path)) return true;
  if (/\/projects\/[^/]+\/jobs$/.test(path)) return true;
  if (/\/import\/[^/]+\/async/.test(path)) return true;
  if (/\/import\/(csv|geojson|kml|spark|shapefile)(\/async)?/.test(path)) return true;
  return false;
}

export function parseRequestBody(body: BodyInit | null | undefined): unknown {
  if (body == null) return null;
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as unknown;
    } catch {
      return body;
    }
  }
  if (body instanceof FormData) {
    const names: string[] = [];
    body.forEach((_v, key) => names.push(key));
    return { _type: 'FormData', fields: names };
  }
  return { _type: typeof body };
}
