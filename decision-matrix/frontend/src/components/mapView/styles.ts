import { Circle as CircleStyle, Fill, Icon, Stroke, Style } from 'ol/style';
import type { InfraLayer } from '../../lib/api';
import { MAP_SUBTYPE_COLORS, iconDataUrl } from '../../lib/mapIcons';
import { HOVER_GLOW, HOVER_RING_FILL, HOVER_RING_STROKE, STATUS_LINE_COLOR } from './constants';

export function layerOpacityMap(layers: InfraLayer[] | undefined): Record<string, number> {
  const m: Record<string, number> = {};
  layers?.forEach((l) => {
    m[l.id] = l.is_visible ? (l.opacity ?? 1) : 0;
  });
  return m;
}

export function layerColorMap(layers: InfraLayer[] | undefined): Record<string, string> {
  const m: Record<string, string> = {};
  layers?.forEach((l) => {
    const c = (l.style_config as { color?: string })?.color;
    if (c) m[l.id] = c;
  });
  return m;
}

export function lineStyleForStatus(status: string): Style {
  const color = STATUS_LINE_COLOR[status] || '#2196f3';
  const dashed = status === 'construction_required';
  return new Style({
    stroke: new Stroke({
      color,
      width: 2,
      lineDash: dashed ? [8, 8] : undefined,
    }),
  });
}

export function lineStrokeStyles(color: string, width: number, hovered: boolean): Style[] {
  if (!hovered) {
    return [
      new Style({
        stroke: new Stroke({ color, width, lineCap: 'round', lineJoin: 'round' }),
      }),
    ];
  }
  return [
    new Style({
      stroke: new Stroke({
        color: HOVER_GLOW,
        width: width + 8,
        lineCap: 'round',
        lineJoin: 'round',
      }),
    }),
    new Style({
      stroke: new Stroke({
        color,
        width: width + 1,
        lineCap: 'round',
        lineJoin: 'round',
      }),
    }),
  ];
}

export function softHoverRing(scale = 1): Style {
  return new Style({
    image: new CircleStyle({
      radius: 20 * scale,
      fill: new Fill({ color: HOVER_RING_FILL }),
      stroke: new Stroke({ color: HOVER_RING_STROKE, width: 1.5 }),
    }),
  });
}

export function pointIconStyle(subtype: string, scale = 1): Style[] {
  const isPoi = subtype === 'poi';
  const iconScale = (isPoi ? 1.1 : 0.95) * scale;
  // Lucide SVG icons are stroke-only; add invisible circle so the whole icon area is clickable.
  const hitRadius = (isPoi ? 18 : 16) * scale;
  return [
    new Style({
      image: new CircleStyle({
        radius: hitRadius,
        fill: new Fill({ color: 'rgba(255,255,255,0.001)' }),
      }),
    }),
    new Style({
      image: new Icon({
        src: iconDataUrl(subtype),
        scale: iconScale,
        anchor: [0.5, isPoi ? 1 : 0.5],
      }),
    }),
  ];
}

export function fallbackPointStyle(subtype: string, scale = 1): Style {
  const color = subtype === 'poi' ? '#e53935' : MAP_SUBTYPE_COLORS[subtype] || '#666';
  return new Style({
    image: new CircleStyle({
      radius: (subtype === 'poi' ? 10 : 7) * scale,
      fill: new Fill({ color }),
      stroke: new Stroke({ color: '#fff', width: 2 }),
    }),
  });
}

export function placementPreviewStyles(subtype: string, useIcons: boolean): Style[] {
  const ring = new Style({
    image: new CircleStyle({
      radius: 22,
      fill: new Fill({ color: 'rgba(33, 150, 243, 0.12)' }),
      stroke: new Stroke({ color: 'rgba(33, 150, 243, 0.55)', width: 2, lineDash: [5, 5] }),
    }),
  });
  const base = useIcons ? pointIconStyle(subtype, 1) : [fallbackPointStyle(subtype, 1)];
  return [ring, ...base];
}

export function pointFeatureStyles(
  subtype: string,
  scale: number,
  hovered: boolean,
  useIcons: boolean
): Style[] {
  const iconScale = hovered ? scale * 1.06 : scale;
  const base = useIcons ? pointIconStyle(subtype, iconScale) : [fallbackPointStyle(subtype, iconScale)];
  return hovered ? [softHoverRing(iconScale), ...base] : base;
}

/** Invisible hit target for earthwork points when footprint polygons are shown. */
export function footprintModePointHitStyle(hovered: boolean): Style[] {
  return [
    new Style({
      image: new CircleStyle({
        radius: hovered ? 10 : 8,
        fill: new Fill({ color: 'rgba(0,0,0,0.01)' }),
        stroke: new Stroke({
          color: hovered ? 'rgba(33, 150, 243, 0.45)' : 'rgba(0,0,0,0.01)',
          width: hovered ? 2 : 1,
        }),
      }),
    }),
  ];
}

export function padFootprintFeatureStyles(
  subtype: string,
  hovered: boolean,
  layerOpacity: number,
): Style[] {
  if (layerOpacity <= 0) return [new Style({})];
  const color = MAP_SUBTYPE_COLORS[subtype] || '#666';
  const fillAlpha = hovered ? '40' : '26';
  const strokeWidth = hovered ? 2.5 : 2;
  return [
    new Style({
      fill: new Fill({ color: `${color}${fillAlpha}` }),
      stroke: new Stroke({
        color: hovered ? '#2196f3' : color,
        width: strokeWidth,
      }),
    }),
  ];
}
