import {
  LAYOUT_H,
  LAYOUT_W,
  MIN_GEO_SPAN,
  NET_SIZE,
  PADDING,
  SITE_H,
  SITE_W,
} from './constants';
import type { GeoFrame, SiteSpec } from './types';
import type { SandLogisticsSubnet } from '../api';

export function buildGeoFrame(
  points: { lon: number; lat: number }[],
  marginRatio = 0,
): GeoFrame | null {
  if (points.length === 0) return null;

  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const p of points) {
    if (!Number.isFinite(p.lon) || !Number.isFinite(p.lat)) continue;
    minLon = Math.min(minLon, p.lon);
    maxLon = Math.max(maxLon, p.lon);
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
  }
  if (!Number.isFinite(minLon)) return null;

  if (marginRatio > 0) {
    const rawSpanLon = Math.max(maxLon - minLon, MIN_GEO_SPAN);
    const rawSpanLat = Math.max(maxLat - minLat, MIN_GEO_SPAN);
    const expandLon = rawSpanLon * marginRatio;
    const expandLat = rawSpanLat * marginRatio;
    minLon -= expandLon;
    maxLon += expandLon;
    minLat -= expandLat;
    maxLat += expandLat;
  }

  const spanLon = Math.max(maxLon - minLon, MIN_GEO_SPAN);
  const spanLat = Math.max(maxLat - minLat, MIN_GEO_SPAN);
  const innerW = LAYOUT_W - 2 * PADDING;
  const innerH = LAYOUT_H - 2 * PADDING;
  const scale = Math.min(innerW / spanLon, innerH / spanLat) * 0.92;
  const usedW = spanLon * scale;
  const usedH = spanLat * scale;

  return {
    minLon,
    maxLon,
    minLat,
    maxLat,
    scale,
    offsetX: PADDING + (innerW - usedW) / 2,
    offsetY: PADDING + (innerH - usedH) / 2,
  };
}

export function geoCenter(frame: GeoFrame, lon: number, lat: number): { cx: number; cy: number } {
  return {
    cx: frame.offsetX + (lon - frame.minLon) * frame.scale,
    cy: frame.offsetY + (frame.maxLat - lat) * frame.scale,
  };
}

function centerToTopLeft(cx: number, cy: number, w: number, h: number): { x: number; y: number } {
  return { x: cx - w / 2, y: cy - h / 2 };
}

export function geoToTopLeft(
  frame: GeoFrame,
  lon: number,
  lat: number,
  w: number,
  h: number,
): { x: number; y: number } {
  const { cx, cy } = geoCenter(frame, lon, lat);
  return centerToTopLeft(cx, cy, w, h);
}

export function geoKey(lon: number, lat: number): string {
  return `${lon.toFixed(6)}|${lat.toFixed(6)}`;
}

export function siteGeoAnchor(frame: GeoFrame, spec: SiteSpec): { x: number; y: number } {
  return geoToTopLeft(frame, spec.lon, spec.lat, SITE_W, SITE_H);
}

export function applyGeoFrameScaleBoost(frame: GeoFrame, boost: number): void {
  if (boost === 1) return;
  frame.scale *= boost;
  const spanLon = Math.max(frame.maxLon - frame.minLon, MIN_GEO_SPAN);
  const spanLat = Math.max(frame.maxLat - frame.minLat, MIN_GEO_SPAN);
  const innerW = LAYOUT_W - 2 * PADDING;
  const innerH = LAYOUT_H - 2 * PADDING;
  const usedW = spanLon * frame.scale;
  const usedH = spanLat * frame.scale;
  frame.offsetX = PADDING + (innerW - usedW) / 2;
  frame.offsetY = PADDING + (innerH - usedH) / 2;
}

/** Точки lon/lat для geo-frame: объекты + их snap-узлы (не вся сеть). */
export function buildGeoFramePointsForSites(
  siteSpecs: SiteSpec[],
  networkNodes: SandLogisticsSubnet['network_nodes'],
): { lon: number; lat: number }[] {
  const points: { lon: number; lat: number }[] = [];
  const nodeById = new Map((networkNodes ?? []).map((n) => [n.id, n]));

  for (const spec of siteSpecs) {
    points.push({ lon: spec.lon, lat: spec.lat });
    const snap = nodeById.get(spec.snapNodeId);
    if (snap && Number.isFinite(snap.lon) && Number.isFinite(snap.lat)) {
      points.push({ lon: snap.lon, lat: snap.lat });
    }
  }
  return points;
}

export function geoToTopLeftForNetworkNode(
  frame: GeoFrame,
  lon: number,
  lat: number,
): { x: number; y: number } {
  return geoToTopLeft(frame, lon, lat, NET_SIZE, NET_SIZE);
}
