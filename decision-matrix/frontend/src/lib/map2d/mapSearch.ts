import type { InfraLayer, InfraObject, POI } from '../api';

export type MapSearchHit = {
  kind: 'poi' | 'infra';
  id: string;
  name: string;
  subtitle: string;
  matchReason?: string;
};

export type MapSearchContext = {
  layers: InfraLayer[];
  subtypeLabels: Record<string, string>;
};

const POI_SEARCH_FIELDS: (keyof POI)[] = [
  'name',
  'description',
  'fluid_type',
  'eng_power',
  'eng_injection',
  'eng_gas',
  'eng_oil_preparation',
  'eng_well_gathering',
  'eng_transport',
];

function norm(s: string): string {
  return s.trim().toLowerCase();
}

function haystackIncludes(haystack: string, q: string): boolean {
  return haystack.toLowerCase().includes(q);
}

function layerName(layerId: string | undefined, layers: InfraLayer[]): string | null {
  if (!layerId) return null;
  return layers.find((l) => l.id === layerId)?.name ?? null;
}

function matchPropertyValues(
  properties: Record<string, unknown> | undefined,
  q: string,
): string | null {
  if (!properties) return null;
  const desc = properties.description;
  if (typeof desc === 'string' && haystackIncludes(desc, q)) {
    return 'Описание';
  }
  for (const [key, value] of Object.entries(properties)) {
    if (key === 'description') continue;
    if (typeof value === 'string' && haystackIncludes(value, q)) {
      return key;
    }
    if (typeof value === 'number' && Number.isFinite(value) && String(value).includes(q)) {
      return key;
    }
  }
  return null;
}

export function infraMatchesMapQuery(
  obj: InfraObject,
  rawQuery: string,
  ctx: MapSearchContext,
): { match: boolean; reason?: string } {
  const q = norm(rawQuery);
  if (!q) return { match: true };

  if (haystackIncludes(obj.name, q)) return { match: true, reason: 'Название' };

  if (haystackIncludes(obj.subtype, q)) return { match: true, reason: 'Подтип' };

  const subtypeLabel = ctx.subtypeLabels[obj.subtype];
  if (subtypeLabel && haystackIncludes(subtypeLabel, q)) {
    return { match: true, reason: `Подтип: ${subtypeLabel}` };
  }

  const layer = layerName(obj.layer_id, ctx.layers);
  if (layer && haystackIncludes(layer, q)) {
    return { match: true, reason: `Слой: ${layer}` };
  }

  const propKey = matchPropertyValues(obj.properties, q);
  if (propKey) return { match: true, reason: `Свойство: ${propKey}` };

  return { match: false };
}

export function poiMatchesMapQuery(poi: POI, rawQuery: string): { match: boolean; reason?: string } {
  const q = norm(rawQuery);
  if (!q) return { match: true };

  if (haystackIncludes(poi.name, q)) return { match: true, reason: 'Название' };

  for (const field of POI_SEARCH_FIELDS) {
    if (field === 'name') continue;
    const value = poi[field];
    if (value == null || value === '') continue;
    if (haystackIncludes(String(value), q)) {
      return { match: true, reason: field === 'description' ? 'Описание' : String(field) };
    }
  }

  return { match: false };
}

export function buildMapSearchHits(
  pois: POI[],
  infraObjects: InfraObject[],
  rawQuery: string,
  ctx: MapSearchContext,
  limit = 10,
): MapSearchHit[] {
  const q = norm(rawQuery);
  if (!q) return [];

  const hits: MapSearchHit[] = [];

  for (const p of pois) {
    const { match, reason } = poiMatchesMapQuery(p, q);
    if (!match) continue;
    hits.push({
      kind: 'poi',
      id: p.id,
      name: p.name,
      subtitle: reason ? `Точка интереса · ${reason}` : 'Точка интереса',
      matchReason: reason,
    });
    if (hits.length >= limit) return hits;
  }

  for (const o of infraObjects) {
    const { match, reason } = infraMatchesMapQuery(o, q, ctx);
    if (!match) continue;
    const defaultSubtitle = ctx.subtypeLabels[o.subtype] || o.subtype;
    hits.push({
      kind: 'infra',
      id: o.id,
      name: o.name,
      subtitle: reason ?? defaultSubtitle,
      matchReason: reason,
    });
    if (hits.length >= limit) return hits;
  }

  return hits;
}

export function filterInfraByMapQuery(
  objects: InfraObject[],
  rawQuery: string,
  ctx: MapSearchContext,
): InfraObject[] {
  const q = norm(rawQuery);
  if (!q) return objects;
  return objects.filter((o) => infraMatchesMapQuery(o, q, ctx).match);
}
