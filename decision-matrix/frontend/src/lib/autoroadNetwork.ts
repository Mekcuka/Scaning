/** Terminals for autoroad network build (exclude node cluster). */

export const AUTOROAD_NETWORK_EXCLUDED_SUBTYPES = [
  'node',
  'methanol_joint',
  'power_line_node',
] as const;

export function isAutoroadNetworkTerminal(
  kind: 'poi' | 'infra',
  subtype?: string | null,
): boolean {
  if (kind !== 'infra' || !subtype) return false;
  return !(AUTOROAD_NETWORK_EXCLUDED_SUBTYPES as readonly string[]).includes(subtype);
}
