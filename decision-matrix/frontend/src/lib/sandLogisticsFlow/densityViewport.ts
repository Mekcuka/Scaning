import type { Node } from '@xyflow/react';
import {
  DEFAULT_FLOW_VIEWPORT_H,
  DEFAULT_FLOW_VIEWPORT_MAX_ZOOM,
  DEFAULT_FLOW_VIEWPORT_PAD,
  DEFAULT_FLOW_VIEWPORT_W,
  GEO_FRAME_MARGIN,
  SAND_FLOW_MAX_GEO_DRIFT,
  SITE_GAP,
  SITE_H,
  SITE_W,
} from './constants';
import type { SandSiteDensitySpread } from './types';

function clampDensity(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Адаптивное разведение блоков по числу объектов на схеме. */
export function computeSiteDensitySpread(siteCount: number): SandSiteDensitySpread {
  const extra = Math.max(0, siteCount - 3);
  return {
    geoScaleBoost: clampDensity(1 + extra * 0.08, 1, 1.7),
    layoutGap: clampDensity(SITE_GAP + extra * 3, SITE_GAP, 36),
    maxDrift: clampDensity(SAND_FLOW_MAX_GEO_DRIFT + extra * 12, SAND_FLOW_MAX_GEO_DRIFT, 240),
    geoMargin: clampDensity(GEO_FRAME_MARGIN + extra * 0.02, GEO_FRAME_MARGIN, 0.28),
  };
}

export function adaptiveNodeClearance(siteCount: number): number {
  const NODE_CLEARANCE_BASE = 52;
  const scale = Math.sqrt(siteCount / 6);
  const clamped = Math.max(0.75, Math.min(1.15, scale));
  return NODE_CLEARANCE_BASE * clamped;
}

/** Минимальный зазор между bbox site-узлов (для тестов). */
export function minSandFlowSitePairwiseGap(
  nodes: Pick<Node, 'id' | 'position'>[],
  siteNodeIds: string[],
): number {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const rects = siteNodeIds
    .map((id) => byId.get(id))
    .filter((n): n is Pick<Node, 'id' | 'position'> => n != null)
    .map((n) => ({
      x: n.position.x,
      y: n.position.y,
      w: SITE_W,
      h: SITE_H,
    }));

  if (rects.length < 2) return Infinity;

  let minGap = Infinity;
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i]!;
      const b = rects[j]!;
      const gapX = Math.max(0, Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w)));
      const gapY = Math.max(0, Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h)));
      if (gapX === 0 && gapY === 0) {
        minGap = 0;
      } else if (gapX === 0) {
        minGap = Math.min(minGap, gapY);
      } else if (gapY === 0) {
        minGap = Math.min(minGap, gapX);
      } else {
        minGap = Math.min(minGap, Math.hypot(gapX, gapY));
      }
    }
  }
  return minGap;
}

/** Синхронный viewport по bbox site-узлов — не требует async fitView. */
export function computeSandFlowDefaultViewport(
  nodes: Pick<Node, 'id' | 'position'>[],
  siteNodeIds: string[],
  viewportWidth = DEFAULT_FLOW_VIEWPORT_W,
  viewportHeight = DEFAULT_FLOW_VIEWPORT_H,
): { x: number; y: number; zoom: number } {
  if (siteNodeIds.length === 0 || viewportWidth < 32 || viewportHeight < 32) {
    return { x: 0, y: 0, zoom: 1 };
  }

  const byId = new Map(nodes.map((n) => [n.id, n]));
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let count = 0;

  for (const id of siteNodeIds) {
    const node = byId.get(id);
    if (!node) continue;
    count++;
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + SITE_W);
    maxY = Math.max(maxY, node.position.y + SITE_H);
  }

  if (count === 0 || !Number.isFinite(minX)) {
    return { x: 0, y: 0, zoom: 1 };
  }

  const pad = DEFAULT_FLOW_VIEWPORT_PAD;
  const contentW = Math.max(maxX - minX, SITE_W);
  const contentH = Math.max(maxY - minY, SITE_H);
  const zoom = Math.min(
    (viewportWidth * (1 - pad * 2)) / contentW,
    (viewportHeight * (1 - pad * 2)) / contentH,
    DEFAULT_FLOW_VIEWPORT_MAX_ZOOM,
  );
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  return {
    x: viewportWidth / 2 - cx * zoom,
    y: viewportHeight / 2 - cy * zoom,
    zoom: Math.max(zoom, 0.12),
  };
}
