/** Terminals for autoroad network build (exclude node cluster). */

import { LINE_SUBTYPES, type InfraObject } from './api';
import { parseMapBbox } from './mapBboxUtils';

export const AUTOROAD_NETWORK_EXCLUDED_SUBTYPES = [
  'node',
  'methanol_joint',
  'power_line_node',
] as const;

export type AutoroadNetworkPickMode = 'click' | 'box';

export function isLineInfraSubtype(subtype?: string | null): boolean {
  if (!subtype) return false;
  return LINE_SUBTYPES.includes(subtype as (typeof LINE_SUBTYPES)[number]);
}

export function isAutoroadNetworkTerminal(
  kind: 'poi' | 'infra',
  subtype?: string | null,
): boolean {
  if (kind !== 'infra' || !subtype) return false;
  return !(AUTOROAD_NETWORK_EXCLUDED_SUBTYPES as readonly string[]).includes(subtype);
}

export function isEligibleAutoroadTerminalObject(obj: InfraObject): boolean {
  if (isLineInfraSubtype(obj.subtype)) return false;
  return isAutoroadNetworkTerminal('infra', obj.subtype);
}

export function infraObjectInBbox(obj: InfraObject, bbox: string): boolean {
  const parsed = parseMapBbox(bbox);
  if (!parsed) return true;
  const [minLon, minLat, maxLon, maxLat] = parsed;
  return obj.lon >= minLon && obj.lon <= maxLon && obj.lat >= minLat && obj.lat <= maxLat;
}

export function mergeTerminalIds(current: string[], added: Iterable<string>): string[] {
  const seen = new Set(current);
  const next = [...current];
  for (const id of added) {
    if (seen.has(id)) continue;
    seen.add(id);
    next.push(id);
  }
  return next;
}
