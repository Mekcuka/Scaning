/** Map icons from lucide-react and custom SVG for OpenLayers. */

import { createElement, type ComponentType } from 'react';
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
import { normalizeInfraSubtype } from './api';
import { IeMapIcon } from './ieSubtypeIcons';

type MapIconComponent = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

/** Узел: чёрная точка (r=4.9 в viewBox 24), canvas 15×15 px. */
function NodeMapIcon({ size = 15 }: { size?: number; color?: string; strokeWidth?: number }) {
  return createElement(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'none',
    },
    createElement('circle', { cx: 12, cy: 12, r: 4.9, fill: '#000' }),
  );
}

const ICON_MAP: Record<string, MapIconComponent> = {
  poi: MapPin,
  gas_processing: Factory,
  ukg: Factory,
  tsg: Factory,
  gtes: IeMapIcon,
  gpes: IeMapIcon,
  vies: IeMapIcon,
  ie: IeMapIcon,
  substation: Zap,
  refinery: Factory,
  node: NodeMapIcon,
  oil_pad: LandPlot,
  gas_pad: LandPlot,
  preliminary_water_discharge_station: Factory,
  booster_pumping_station: Factory,
  oil_pumping_station: Factory,
  ground_pumping_station: Factory,
  sand_quarry: Mountain,
  methanol_facility: Pipette,
  methanol_joint: CircleDot,
  power_line_node: Zap,
  offplot: MapPin,
  additional_facility: Factory,
  well_bottomhole_nnb: CircleDot,
  well_bottomhole_gs: Minus,
  well_bottomhole_gs_heel: CircleDot,
  well_bottomhole_gs_toe: CircleDot,
  well_bottomhole_lateral: CircleDot,
  autoroad: Minus,
  oil_pipeline: Minus,
  gas_pipeline: Flame,
  water_pipeline: Minus,
  power_line: Zap,
  methanol_pipeline: Pipette,
  additional_line: Minus,
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
  ie: '#c62828',
  substation: '#f9a825',
  refinery: '#455a64',
  node: '#6a1b9a',
  oil_pad: '#5d4037',
  gas_pad: '#fbc02d',
  preliminary_water_discharge_station: '#0277bd',
  booster_pumping_station: '#1565c0',
  oil_pumping_station: '#5d4037',
  ground_pumping_station: '#283593',
  sand_quarry: '#8d6e63',
  methanol_facility: '#7b1fa2',
  methanol_joint: '#9c27b0',
  power_line_node: '#2e7d32',
  offplot: '#546e7a',
  additional_facility: '#78909c',
  well_bottomhole_nnb: '#1565c0',
  well_bottomhole_gs: '#2e7d32',
  well_bottomhole_gs_heel: '#2e7d32',
  well_bottomhole_gs_toe: '#c62828',
  well_bottomhole_lateral: '#7b1fa2',
  autoroad: '#000000',
  oil_pipeline: '#5d4037',
  gas_pipeline: '#fbc02d',
  water_pipeline: '#2196f3',
  power_line: '#2e7d32',
  methanol_pipeline: '#6a1b9a',
  additional_line: '#8d6e63',
  network_node: '#7b1fa2',
};

const cache = new Map<string, string>();

function renderIconDataUrl(subtype: string): string {
  const iconKey = ICON_MAP[subtype] ? subtype : 'gas_processing';
  const color = MAP_SUBTYPE_COLORS[iconKey] || '#666';
  const cacheKey = iconKey === 'node' ? 'node:black-dot:15' : `${iconKey}:${color}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;
  const Icon = ICON_MAP[iconKey] || Factory;
  const iconSize = iconKey === 'poi' ? 28 : iconKey === 'node' ? 15 : 22;
  const svg = renderToStaticMarkup(
    createElement(Icon, {
      size: iconSize,
      color,
      strokeWidth: 2,
      ...(iconKey === 'poi' ? { fill: color } : {}),
    })
  );
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  cache.set(cacheKey, url);
  return url;
}

export function iconDataUrl(subtype: string): string {
  return renderIconDataUrl(normalizeInfraSubtype(subtype));
}

/** @deprecated use iconDataUrl — kept for callers; ИЭ subtypes share one icon shape. */
export function iconMenuDataUrl(subtype: string): string {
  return iconDataUrl(subtype);
}
