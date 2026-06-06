import {
  FINAL_GEO_PULL,
  GEO_PULL,
  NODE_REPEL_RADIUS_PX,
  ROAD_CLEARANCE,
  ROAD_CLEARANCE_FINAL,
  SAND_FLOW_MAX_GEO_DRIFT,
  SAND_FLOW_SITE_GAP,
  SITE_H,
  SITE_LAYOUT_PAD,
  SITE_W,
} from './constants';
import { adaptiveNodeClearance, computeSiteDensitySpread } from './densityViewport';
import { geoCenter } from './geoFrame';
import {
  pushRectsApart,
  rectsOverlap,
  repelRectFromPoint,
  repelRectFromSegment,
  separateRects,
} from './geometry';
import { filterNodeCentersForSite } from './roadGraph';
import type {
  GeoFrame,
  LayoutRect,
  RoadSegment,
  SandFlowLayoutRect,
  SandSiteDensitySpread,
  SiteSpec,
} from './types';

/** Несколько объектов в одной точке карты — веер вокруг гео-центра. */
function spreadCoincidentGeoSites(
  sites: LayoutRect[],
  geoKeyById: Map<string, string>,
  frame: GeoFrame,
  siteSpecById: Map<string, SiteSpec>,
  layoutGap: number,
): void {
  const groups = new Map<string, LayoutRect[]>();
  for (const s of sites) {
    const key = geoKeyById.get(s.id) ?? s.id;
    const list = groups.get(key) ?? [];
    list.push(s);
    groups.set(key, list);
  }

  for (const group of groups.values()) {
    if (group.length <= 1) continue;
    group.sort((a, b) => a.id.localeCompare(b.id));

    const lead = siteSpecById.get(group[0]!.id);
    if (!lead) continue;
    const { cx, cy } = geoCenter(frame, lead.lon, lead.lat);
    const minRadius =
      group.length > 1
        ? (SITE_W + layoutGap) / (2 * Math.sin(Math.PI / group.length))
        : SITE_W / 2 + layoutGap;
    const radius = Math.max(minRadius, SITE_H / 2 + layoutGap);

    group.forEach((s, i) => {
      const angle = (2 * Math.PI * i) / group.length - Math.PI / 2;
      const bx = cx + Math.cos(angle) * radius - SITE_W / 2;
      const by = cy + Math.sin(angle) * radius - SITE_H / 2;
      s.x = bx;
      s.y = by;
      s.ax = bx;
      s.ay = by;
    });
  }
}

function localRoadTangentAtSnap(
  snapId: string,
  snapCenters: Map<string, { cx: number; cy: number }>,
  roadSegments: RoadSegment[],
): { tx: number; ty: number; nx: number; ny: number } {
  const snap = snapCenters.get(snapId);
  if (!snap) return { tx: 1, ty: 0, nx: 0, ny: 1 };

  for (const seg of roadSegments) {
    const d1 = Math.hypot(seg.x1 - snap.cx, seg.y1 - snap.cy);
    const d2 = Math.hypot(seg.x2 - snap.cx, seg.y2 - snap.cy);
    if (d1 < 4 || d2 < 4) {
      let dx = seg.x2 - seg.x1;
      let dy = seg.y2 - seg.y1;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len;
      dy /= len;
      return { tx: dx, ty: dy, nx: -dy, ny: dx };
    }
  }
  return { tx: 1, ty: 0, nx: 0, ny: 1 };
}

/** Несколько объектов на одном snap — развод перпендикулярно дороге, якорь не сдвигается. */
function spreadSitesAtSharedSnap(
  sites: LayoutRect[],
  siteSnapIds: Map<string, string>,
  snapCenters: Map<string, { cx: number; cy: number }>,
  roadSegments: RoadSegment[],
  layoutGap: number,
): void {
  const groups = new Map<string, LayoutRect[]>();
  for (const s of sites) {
    const snapId = siteSnapIds.get(s.id);
    if (!snapId) continue;
    const list = groups.get(snapId) ?? [];
    list.push(s);
    groups.set(snapId, list);
  }

  for (const [snapId, group] of groups) {
    if (group.length <= 1) continue;
    const { tx, ty, nx, ny } = localRoadTangentAtSnap(snapId, snapCenters, roadSegments);
    group.sort((a, b) => {
      const acx = a.ax + a.w / 2;
      const acy = a.ay + a.h / 2;
      const bcx = b.ax + b.w / 2;
      const bcy = b.ay + b.h / 2;
      return acx * tx + acy * ty - (bcx * tx + bcy * ty);
    });
    const mid = (group.length - 1) / 2;
    const step = (SITE_H + layoutGap) * 1.2;
    group.forEach((s, i) => {
      const offset = (i - mid) * step;
      s.x += nx * offset;
      s.y += ny * offset;
    });
  }
}

/** Гарантирует отсутствие перекрытий между блоками (зазор ≥ gap). */
export function enforceSandFlowSitesNoOverlap(
  rects: SandFlowLayoutRect[],
  gap: number = SAND_FLOW_SITE_GAP,
  maxPasses = 160,
): void {
  for (let pass = 0; pass < maxPasses; pass++) {
    let moved = false;
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i]!;
        const b = rects[j]!;
        if (rectsOverlap(a, b, gap)) {
          separateRects(a as LayoutRect, b as LayoutRect, gap);
          moved = true;
        }
      }
    }
    if (!moved) break;
  }
}

function siteNodeToLayoutRect(pos: { x: number; y: number }, id: string): SandFlowLayoutRect {
  const pad = SITE_LAYOUT_PAD;
  return {
    id,
    x: pos.x - pad,
    y: pos.y - pad,
    w: SITE_W + pad * 2,
    h: SITE_H + pad * 2,
  };
}

export function layoutRectToNodePosition(rect: SandFlowLayoutRect): { x: number; y: number } {
  return { x: rect.x + SITE_LAYOUT_PAD, y: rect.y + SITE_LAYOUT_PAD };
}

export function sandFlowSiteRectsFromPositions(
  siteIds: string[],
  positions: Map<string, { x: number; y: number }>,
): SandFlowLayoutRect[] {
  return siteIds.map((id) => {
    const pos = positions.get(id) ?? { x: 0, y: 0 };
    return siteNodeToLayoutRect(pos, id);
  });
}

/** Финальное разведение после сдвига по году ввода или ручного drag. */
export function finalizeSandFlowSitePositions(
  rects: SandFlowLayoutRect[],
  siteCount: number,
): void {
  const { layoutGap } = computeSiteDensitySpread(siteCount);
  enforceSandFlowSitesNoOverlap(rects, layoutGap, 240);
}

export function applySandFlowSitePositions<
  T extends { id: string; type?: string; position: { x: number; y: number } },
>(nodes: T[], options?: { movedNodeId?: string; siteCount?: number }): T[] {
  const siteNodes = nodes.filter((n) => n.type === 'sandFlowNode');
  if (siteNodes.length < 2) return nodes;

  const layoutGap =
    computeSiteDensitySpread(options?.siteCount ?? siteNodes.length).layoutGap;

  const layoutRects = siteNodes.map((n) => siteNodeToLayoutRect(n.position, n.id));

  if (options?.movedNodeId) {
    const moved = layoutRects.find((r) => r.id === options.movedNodeId);
    const others = layoutRects.filter((r) => r.id !== options.movedNodeId);
    if (moved) {
      for (let pass = 0; pass < 80; pass++) {
        let shifted = false;
        for (const other of others) {
          if (
            moved.x < other.x + other.w + layoutGap &&
            moved.x + moved.w + layoutGap > other.x &&
            moved.y < other.y + other.h + layoutGap &&
            moved.y + moved.h + layoutGap > other.y
          ) {
            const mcx = moved.x + moved.w / 2;
            const mcy = moved.y + moved.h / 2;
            const ocx = other.x + other.w / 2;
            const ocy = other.y + other.h / 2;
            const overlapX =
              (moved.w + other.w) / 2 + layoutGap - Math.abs(mcx - ocx);
            const overlapY =
              (moved.h + other.h) / 2 + layoutGap - Math.abs(mcy - ocy);
            if (overlapX <= 0 || overlapY <= 0) continue;
            if (overlapX < overlapY) {
              moved.x += (overlapX + 1) * (mcx >= ocx ? 1 : -1);
            } else {
              moved.y += (overlapY + 1) * (mcy >= ocy ? 1 : -1);
            }
            shifted = true;
          }
        }
        if (!shifted) break;
      }
    }
  } else {
    enforceSandFlowSitesNoOverlap(layoutRects, layoutGap, 240);
  }

  const byId = new Map(layoutRects.map((r) => [r.id, r]));
  return nodes.map((n) => {
    const next = byId.get(n.id);
    return next ? { ...n, position: layoutRectToNodePosition(next) } : n;
  });
}

function enforceNonOverlappingSites(sites: LayoutRect[], gap: number): void {
  enforceSandFlowSitesNoOverlap(sites, gap, 200);
}

export function clampToGeoAnchor(s: LayoutRect, maxDrift: number = SAND_FLOW_MAX_GEO_DRIFT): void {
  const cx = s.x + s.w / 2;
  const cy = s.y + s.h / 2;
  const ax = s.ax + s.w / 2;
  const ay = s.ay + s.h / 2;
  const dx = cx - ax;
  const dy = cy - ay;
  const dist = Math.hypot(dx, dy);
  if (dist <= maxDrift) return;
  const scale = maxDrift / dist;
  const nx = ax + dx * scale;
  const ny = ay + dy * scale;
  s.x = nx - s.w / 2;
  s.y = ny - s.h / 2;
}

/** Разводит блоки, сохраняя привязку к geo-якорю (lon/lat). */
export function resolveSiteLayout(
  sites: LayoutRect[],
  roadSegments: RoadSegment[],
  snapCenters: Map<string, { cx: number; cy: number }>,
  siteSnapIds: Map<string, string>,
  geoKeyById: Map<string, string>,
  frame: GeoFrame,
  siteSpecById: Map<string, SiteSpec>,
  influenceNodeIds: Set<string>,
  density: SandSiteDensitySpread,
): void {
  if (sites.length === 0) return;

  const { layoutGap, maxDrift } = density;
  const nodeClearance = adaptiveNodeClearance(sites.length);

  spreadCoincidentGeoSites(sites, geoKeyById, frame, siteSpecById, layoutGap);
  spreadSitesAtSharedSnap(sites, siteSnapIds, snapCenters, roadSegments, layoutGap);

  for (let iter = 0; iter < 420; iter++) {
    for (let i = 0; i < sites.length; i++) {
      for (let j = i + 1; j < sites.length; j++) {
        pushRectsApart(sites[i]!, sites[j]!, layoutGap);
      }
    }

    for (const s of sites) {
      const anchorCx = s.ax + s.w / 2;
      const anchorCy = s.ay + s.h / 2;
      const ownSnapId = siteSnapIds.get(s.id);
      const nearbyNodes = filterNodeCentersForSite(
        snapCenters,
        influenceNodeIds,
        anchorCx,
        anchorCy,
        ownSnapId,
        NODE_REPEL_RADIUS_PX,
      );

      for (const seg of roadSegments) {
        repelRectFromSegment(s, seg, ROAD_CLEARANCE);
      }
      for (const node of nearbyNodes) {
        repelRectFromPoint(s, node.cx, node.cy, nodeClearance);
      }
    }

    const pull = GEO_PULL * (1 - (iter / 420) * 0.55);
    for (const s of sites) {
      s.x += (s.ax - s.x) * pull;
      s.y += (s.ay - s.y) * pull;
      clampToGeoAnchor(s, maxDrift);
    }
    enforceNonOverlappingSites(sites, layoutGap);
  }

  for (let iter = 0; iter < 48; iter++) {
    for (let i = 0; i < sites.length; i++) {
      for (let j = i + 1; j < sites.length; j++) {
        pushRectsApart(sites[i]!, sites[j]!, layoutGap);
      }
    }
    for (const s of sites) {
      const anchorCx = s.ax + s.w / 2;
      const anchorCy = s.ay + s.h / 2;
      const ownSnapId = siteSnapIds.get(s.id);
      const nearbyNodes = filterNodeCentersForSite(
        snapCenters,
        influenceNodeIds,
        anchorCx,
        anchorCy,
        ownSnapId,
        NODE_REPEL_RADIUS_PX,
      );

      for (const seg of roadSegments) {
        repelRectFromSegment(s, seg, ROAD_CLEARANCE_FINAL);
      }
      for (const node of nearbyNodes) {
        repelRectFromPoint(s, node.cx, node.cy, nodeClearance);
      }
      clampToGeoAnchor(s, maxDrift);
    }
    enforceNonOverlappingSites(sites, layoutGap);
  }

  enforceSandFlowSitesNoOverlap(sites, layoutGap, 240);

  for (let pass = 0; pass < 2; pass++) {
    for (const s of sites) {
      s.x += (s.ax - s.x) * 0.15;
      s.y += (s.ay - s.y) * 0.15;
      clampToGeoAnchor(s, maxDrift);
    }
    enforceNonOverlappingSites(sites, layoutGap);
  }

  for (let pass = 0; pass < 2; pass++) {
    for (const s of sites) {
      s.x += (s.ax - s.x) * FINAL_GEO_PULL;
      s.y += (s.ay - s.y) * FINAL_GEO_PULL;
      clampToGeoAnchor(s, maxDrift);
    }
    enforceNonOverlappingSites(sites, layoutGap);
  }
}
