/** Map icons from lucide-react rendered to data URLs for OpenLayers. */

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  CircleDot,
  Factory,
  Flame,
  LandPlot,
  MapPin,
  Minus,
  Mountain,
  Pipette,
  Zap,
} from 'lucide-react';

const ICON_MAP: Record<string, typeof Factory> = {
  poi: MapPin,
  gas_processing: Factory,
  ukg: Factory,
  tsg: Factory,
  gtes: Flame,
  gpes: Flame,
  vies: Flame,
  substation: Zap,
  refinery: Factory,
  node: CircleDot,
  pad: LandPlot,
  preliminary_water_discharge_station: Factory,
  booster_pumping_station: Factory,
  oil_pumping_station: Factory,
  ground_pumping_station: Factory,
  sand_quarry: Mountain,
  methanol_facility: Pipette,
  methanol_joint: CircleDot,
  autoroad: Minus,
  oil_pipeline: Minus,
  gas_pipeline: Flame,
  water_pipeline: Minus,
  power_line: Zap,
  methanol_pipeline: Pipette,
  network_node: CircleDot,
};

/** Line/point stroke and fallback circle colors (OpenLayers). */
export const MAP_SUBTYPE_COLORS: Record<string, string> = {
  poi: '#e53935',
  gas_processing: '#ff6f00',
  ukg: '#ef6c00',
  tsg: '#fb8c00',
  gtes: '#d84315',
  gpes: '#e64a19',
  vies: '#43a047',
  substation: '#f9a825',
  refinery: '#455a64',
  node: '#6a1b9a',
  pad: '#00897b',
  preliminary_water_discharge_station: '#0277bd',
  booster_pumping_station: '#1565c0',
  oil_pumping_station: '#5d4037',
  ground_pumping_station: '#283593',
  sand_quarry: '#8d6e63',
  methanol_facility: '#7b1fa2',
  methanol_joint: '#9c27b0',
  autoroad: '#000000',
  oil_pipeline: '#5d4037',
  gas_pipeline: '#fbc02d',
  water_pipeline: '#2196f3',
  power_line: '#2e7d32',
  methanol_pipeline: '#6a1b9a',
  network_node: '#7b1fa2',
};

const cache = new Map<string, string>();

export function iconDataUrl(subtype: string): string {
  const key = ICON_MAP[subtype] ? subtype : 'gas_processing';
  if (cache.has(key)) return cache.get(key)!;
  const Icon = ICON_MAP[key] || Factory;
  const color = MAP_SUBTYPE_COLORS[key] || '#666';
  const svg = renderToStaticMarkup(
    createElement(Icon, {
      size: key === 'poi' ? 28 : 22,
      color,
      strokeWidth: 2,
      fill: key === 'poi' ? color : 'none',
    })
  );
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  cache.set(key, url);
  return url;
}
