/** Map icons from lucide-react rendered to data URLs for OpenLayers. */

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  Factory,
  Flame,
  MapPin,
  Minus,
  Zap,
  CircleDot,
} from 'lucide-react';

const ICON_MAP: Record<string, typeof Factory> = {
  poi: MapPin,
  gas_processing: Factory,
  gtes: Flame,
  substation: Zap,
  refinery: Factory,
  node: CircleDot,
  autoroad: Minus,
  oil_pipeline: Minus,
  gas_pipeline: Flame,
  water_pipeline: Minus,
  power_line: Zap,
  network_node: CircleDot,
};

const COLORS: Record<string, string> = {
  poi: '#e53935',
  gas_processing: '#ff6f00',
  gtes: '#d84315',
  substation: '#f9a825',
  refinery: '#455a64',
  node: '#6a1b9a',
  autoroad: '#000000',
  oil_pipeline: '#5d4037',
  gas_pipeline: '#fbc02d',
  water_pipeline: '#2196f3',
  power_line: '#2e7d32',
  network_node: '#7b1fa2',
};

const cache = new Map<string, string>();

export function iconDataUrl(subtype: string): string {
  const key = ICON_MAP[subtype] ? subtype : 'gas_processing';
  if (cache.has(key)) return cache.get(key)!;
  const Icon = ICON_MAP[key] || Factory;
  const color = COLORS[key] || '#666';
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
