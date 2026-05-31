/** L1 default extrusion heights (meters) by infrastructure subtype. */
import l1Data from '../../../../shared/l1_extrusion_heights.json';

const L1_HEIGHTS: Record<string, number> = l1Data.heights;
const DEFAULT_HEIGHT_M = l1Data.default_height_m;

export function defaultHeightForSubtype(subtype: string): number {
  const h = L1_HEIGHTS[subtype];
  return typeof h === 'number' && h > 0 ? h : DEFAULT_HEIGHT_M;
}

/** Half-width of point footprint square (meters) for extrusion polygon. */
export function footprintHalfSizeForSubtype(subtype: string): number {
  const h = defaultHeightForSubtype(subtype);
  if (subtype === 'node' || subtype === 'methanol_joint' || subtype === 'network_node') return 8;
  if (subtype === 'poi') return 12;
  return Math.min(40, Math.max(12, h * 1.2));
}
