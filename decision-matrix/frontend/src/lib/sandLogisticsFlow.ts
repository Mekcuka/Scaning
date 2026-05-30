import {
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  type Edge,
  type Node,
  type Position,
} from '@xyflow/react';
import type { SandLogisticsSubnet } from './api';

export type SandLogisticsLineStyle = 'straight' | 'bezier' | 'smoothstep';

export const SAND_LOGISTICS_LINE_STYLE_OPTIONS: {
  value: SandLogisticsLineStyle;
  label: string;
}[] = [
  { value: 'straight', label: 'Прямые' },
  { value: 'bezier', label: 'Изгибы' },
  { value: 'smoothstep', label: 'Ступеньки' },
];

type EdgePathInput = {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: Position;
  targetPosition: Position;
};

/** Общий расчёт SVG-пути для всех типов линий на схеме логистики. */
export function computeSandEdgePath(
  style: SandLogisticsLineStyle,
  input: EdgePathInput
): [path: string, labelX: number, labelY: number] {
  if (style === 'straight') {
    const [path, labelX, labelY] = getStraightPath(input);
    return [path, labelX, labelY];
  }
  if (style === 'smoothstep') {
    const [path, labelX, labelY] = getSmoothStepPath({ ...input, borderRadius: 8 });
    return [path, labelX, labelY];
  }
  const [path, labelX, labelY] = getBezierPath(input);
  return [path, labelX, labelY];
}

export type SandFlowNodeKind = 'quarry' | 'consumer' | 'network';

export type SandFlowNodeData = {
  kind: SandFlowNodeKind;
  label: string;
  in_service?: boolean;
  lon?: number;
  lat?: number;
  /** Только потребители: спрос и жадная отгрузка для цвета блока */
  demand_m3?: number;
  allocated_m3?: number;
};

export type SandRoadEdgeData = {
  flowM3: number;
  labelOffsetX?: number;
  labelOffsetY?: number;
};

const SITE_W = 160;
const SITE_H = 68;
const SITE_GAP = 10;
export const SAND_FLOW_SITE_W = SITE_W;
export const SAND_FLOW_SITE_H = SITE_H;
export const SAND_FLOW_SITE_GAP = SITE_GAP;
const NET_SIZE = 10;
const LAYOUT_W = 1600;
const LAYOUT_H = 1000;
const PADDING = 80;
const MAX_GEO_DRIFT = 180;
const ROAD_CLEARANCE = 38;
const NODE_CLEARANCE = 88;
const GEO_PULL = 0.04;
const MIN_GEO_SPAN = 0.006;

function quarryId(objectId: string): string {
  return `q:${objectId}`;
}

function consumerId(objectId: string): string {
  return `c:${objectId}`;
}

function networkNodeId(nodeId: string): string {
  return `n:${nodeId}`;
}

function segmentKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function formatSandEdgeM3(value: number): string {
  return `${value.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} м³`;
}

type GeoFrame = {
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
  scale: number;
  offsetX: number;
  offsetY: number;
};

type SiteSpec = {
  id: string;
  snapNodeId: string;
  kind: 'quarry' | 'consumer';
  lon: number;
  lat: number;
};

function buildGeoFrame(points: { lon: number; lat: number }[]): GeoFrame | null {
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

function geoCenter(frame: GeoFrame, lon: number, lat: number): { cx: number; cy: number } {
  return {
    cx: frame.offsetX + (lon - frame.minLon) * frame.scale,
    cy: frame.offsetY + (frame.maxLat - lat) * frame.scale,
  };
}

function centerToTopLeft(cx: number, cy: number, w: number, h: number): { x: number; y: number } {
  return { x: cx - w / 2, y: cy - h / 2 };
}

function geoToTopLeft(
  frame: GeoFrame,
  lon: number,
  lat: number,
  w: number,
  h: number
): { x: number; y: number } {
  const { cx, cy } = geoCenter(frame, lon, lat);
  return centerToTopLeft(cx, cy, w, h);
}

function geoKey(lon: number, lat: number): string {
  return `${lon.toFixed(6)}|${lat.toFixed(6)}`;
}

function siteGeoAnchor(frame: GeoFrame, spec: SiteSpec): { x: number; y: number } {
  return geoToTopLeft(frame, spec.lon, spec.lat, SITE_W, SITE_H);
}

type RoadSegment = { x1: number; y1: number; x2: number; y2: number };

function closestPointOnSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): { x: number; y: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-9) return { x: x1, y: y1 };
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  return { x: x1 + t * dx, y: y1 + t * dy };
}

function rectsOverlap(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }, gap: number): boolean {
  return (
    a.x < b.x + b.w + gap &&
    a.x + a.w + gap > b.x &&
    a.y < b.y + b.h + gap &&
    a.y + a.h + gap > b.y
  );
}

function repelRectFromSegment(s: LayoutRect, seg: RoadSegment, clearance: number): void {
  const samples: [number, number][] = [
    [s.x + s.w / 2, s.y + s.h / 2],
    [s.x + 8, s.y + 8],
    [s.x + s.w - 8, s.y + 8],
    [s.x + 8, s.y + s.h - 8],
    [s.x + s.w - 8, s.y + s.h - 8],
  ];

  for (const [px, py] of samples) {
    const cp = closestPointOnSegment(px, py, seg.x1, seg.y1, seg.x2, seg.y2);
    let dx = px - cp.x;
    let dy = py - cp.y;
    let dist = Math.hypot(dx, dy);
    if (dist < 1e-3) {
      const sdx = seg.x2 - seg.x1;
      const sdy = seg.y2 - seg.y1;
      const segLen = Math.hypot(sdx, sdy) || 1;
      dx = -sdy / segLen;
      dy = sdx / segLen;
      dist = 1;
    }
    if (dist >= clearance) continue;
    const push = ((clearance - dist) / dist) * 0.65;
    s.x += dx * push;
    s.y += dy * push;
  }
}

function repelRectFromPoint(s: LayoutRect, px: number, py: number, minDist: number): void {
  const rx = Math.max(s.x, Math.min(px, s.x + s.w));
  const ry = Math.max(s.y, Math.min(py, s.y + s.h));
  let dx = rx - px;
  let dy = ry - py;
  let dist = Math.hypot(dx, dy);
  if (dist < 1e-3) {
    dx = s.x + s.w / 2 - px;
    dy = s.y + s.h / 2 - py;
    dist = Math.hypot(dx, dy) || 1;
  }
  if (dist >= minDist) return;
  const push = minDist - dist;
  s.x += (dx / dist) * push;
  s.y += (dy / dist) * push;
}

function buildRoadSegments(
  networkEdges: SandLogisticsSubnet['network_edges'],
  positions: Map<string, { x: number; y: number }>
): RoadSegment[] {
  const segments: RoadSegment[] = [];
  const seen = new Set<string>();
  for (const re of networkEdges ?? []) {
    const key = segmentKey(re.from_node_id, re.to_node_id);
    if (seen.has(key)) continue;
    seen.add(key);
    const a = positions.get(networkNodeId(re.from_node_id));
    const b = positions.get(networkNodeId(re.to_node_id));
    if (!a || !b) continue;
    segments.push({
      x1: a.x + NET_SIZE / 2,
      y1: a.y + NET_SIZE / 2,
      x2: b.x + NET_SIZE / 2,
      y2: b.y + NET_SIZE / 2,
    });
  }
  return segments;
}

function estimateLabelSize(flowM3: number): { w: number; h: number } {
  const text = formatSandEdgeM3(flowM3);
  return { w: text.length * 6.4 + 16, h: 20 };
}

function labelBoxOverlapsSites(
  lx: number,
  ly: number,
  lw: number,
  lh: number,
  sites: LayoutRect[]
): boolean {
  const box: LayoutRect = { id: '', x: lx - lw / 2, y: ly - lh / 2, w: lw, h: lh, ax: 0, ay: 0 };
  return sites.some((s) => rectsOverlap(box, s, 10));
}

function flowLabelOffset(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  flowM3: number,
  sites: LayoutRect[]
): { labelOffsetX: number; labelOffsetY: number } {
  const baseX = (sx + tx) / 2;
  const baseY = (sy + ty) / 2;
  const { w, h } = estimateLabelSize(flowM3);
  const segDx = tx - sx;
  const segDy = ty - sy;
  const len = Math.hypot(segDx, segDy) || 1;
  const nx = -segDy / len;
  const ny = segDx / len;
  const alongX = segDx / len;
  const alongY = segDy / len;

  const candidates: [number, number][] = [
    [0, 0],
    [nx * 34, ny * 34],
    [nx * -34, ny * -34],
    [nx * 52, ny * 52],
    [nx * -52, ny * -52],
    [alongX * 40, alongY * 40],
    [alongX * -40, alongY * -40],
    [nx * 34 + alongX * 20, ny * 34 + alongY * 20],
    [nx * -34 + alongX * -20, ny * -34 + alongY * -20],
  ];

  for (const [ox, oy] of candidates) {
    if (!labelBoxOverlapsSites(baseX + ox, baseY + oy, w, h, sites)) {
      return { labelOffsetX: ox, labelOffsetY: oy };
    }
  }
  return { labelOffsetX: nx * 44, labelOffsetY: ny * 44 };
}

type LayoutRect = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Якорь по lon/lat объекта (px на схеме) */
  ax: number;
  ay: number;
};

/** Несколько объектов в одной точке карты — веер вокруг гео-центра. */
function spreadCoincidentGeoSites(
  sites: LayoutRect[],
  geoKeyById: Map<string, string>,
  frame: GeoFrame,
  siteSpecById: Map<string, SiteSpec>
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
        ? (SITE_W + SITE_GAP) / (2 * Math.sin(Math.PI / group.length))
        : SITE_W / 2 + SITE_GAP;
    const radius = Math.max(minRadius, SITE_H / 2 + SITE_GAP);

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

function separateRects(a: LayoutRect, b: LayoutRect, gap: number): void {
  if (!rectsOverlap(a, b, gap)) return;

  const acx = a.x + a.w / 2;
  const acy = a.y + a.h / 2;
  const bcx = b.x + b.w / 2;
  const bcy = b.y + b.h / 2;
  const overlapX = (a.w + b.w) / 2 + gap - Math.abs(acx - bcx);
  const overlapY = (a.h + b.h) / 2 + gap - Math.abs(acy - bcy);
  if (overlapX <= 0 || overlapY <= 0) return;

  if (overlapX < overlapY) {
    const push = overlapX + 1;
    const dir = acx >= bcx ? 1 : -1;
    a.x += push * dir * 0.5;
    b.x -= push * dir * 0.5;
  } else {
    const push = overlapY + 1;
    const dir = acy >= bcy ? 1 : -1;
    a.y += push * dir * 0.5;
    b.y -= push * dir * 0.5;
  }
}

function pushRectsApart(a: LayoutRect, b: LayoutRect, gap: number): void {
  separateRects(a, b, gap);
}

export type SandFlowLayoutRect = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

/** Гарантирует отсутствие перекрытий между блоками (зазор ≥ gap). */
export function enforceSandFlowSitesNoOverlap(
  rects: SandFlowLayoutRect[],
  gap: number = SAND_FLOW_SITE_GAP,
  maxPasses = 160
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

function enforceNonOverlappingSites(sites: LayoutRect[], gap: number): void {
  enforceSandFlowSitesNoOverlap(sites, gap, 200);
}

function clampToGeoAnchor(s: LayoutRect): void {
  const cx = s.x + s.w / 2;
  const cy = s.y + s.h / 2;
  const ax = s.ax + s.w / 2;
  const ay = s.ay + s.h / 2;
  const dx = cx - ax;
  const dy = cy - ay;
  const dist = Math.hypot(dx, dy);
  if (dist <= MAX_GEO_DRIFT) return;
  const scale = MAX_GEO_DRIFT / dist;
  const nx = ax + dx * scale;
  const ny = ay + dy * scale;
  s.x = nx - s.w / 2;
  s.y = ny - s.h / 2;
}

type RoadGraph = Map<string, { neighbor: string; weight: number }[]>;

/** Разводит блоки, сохраняя привязку к гео-якорю (lon/lat). */
function resolveSiteLayout(
  sites: LayoutRect[],
  roadSegments: RoadSegment[],
  nodeCenters: { cx: number; cy: number }[],
  snapCenters: Map<string, { cx: number; cy: number }>,
  siteSnapIds: Map<string, string>,
  geoKeyById: Map<string, string>,
  frame: GeoFrame,
  siteSpecById: Map<string, SiteSpec>
): void {
  if (sites.length === 0) return;

  spreadCoincidentGeoSites(sites, geoKeyById, frame, siteSpecById);

  for (let iter = 0; iter < 420; iter++) {
    for (let i = 0; i < sites.length; i++) {
      for (let j = i + 1; j < sites.length; j++) {
        pushRectsApart(sites[i]!, sites[j]!, SITE_GAP);
      }
    }

    for (const s of sites) {
      for (const seg of roadSegments) {
        repelRectFromSegment(s, seg, ROAD_CLEARANCE);
      }
      for (const node of nodeCenters) {
        repelRectFromPoint(s, node.cx, node.cy, NODE_CLEARANCE);
      }
      const snapId = siteSnapIds.get(s.id);
      if (snapId) {
        const snap = snapCenters.get(snapId);
        if (snap) repelRectFromPoint(s, snap.cx, snap.cy, NODE_CLEARANCE + 8);
      }
    }

    const pull = GEO_PULL * (1 - (iter / 420) * 0.55);
    for (const s of sites) {
      s.x += (s.ax - s.x) * pull;
      s.y += (s.ay - s.y) * pull;
      clampToGeoAnchor(s);
    }
    enforceNonOverlappingSites(sites, SITE_GAP);
  }

  for (let iter = 0; iter < 48; iter++) {
    for (let i = 0; i < sites.length; i++) {
      for (let j = i + 1; j < sites.length; j++) {
        pushRectsApart(sites[i]!, sites[j]!, SITE_GAP);
      }
    }
    for (const s of sites) {
      for (const seg of roadSegments) {
        repelRectFromSegment(s, seg, ROAD_CLEARANCE + 6);
      }
      for (const node of nodeCenters) {
        repelRectFromPoint(s, node.cx, node.cy, NODE_CLEARANCE);
      }
      const snapId = siteSnapIds.get(s.id);
      if (snapId) {
        const snap = snapCenters.get(snapId);
        if (snap) repelRectFromPoint(s, snap.cx, snap.cy, NODE_CLEARANCE + 8);
      }
      clampToGeoAnchor(s);
    }
    enforceNonOverlappingSites(sites, SITE_GAP);
  }

  for (const s of sites) {
    s.x += (s.ax - s.x) * 0.12;
    s.y += (s.ay - s.y) * 0.12;
    clampToGeoAnchor(s);
  }
  enforceNonOverlappingSites(sites, SITE_GAP);
}

function buildRoadGraph(subnet: SandLogisticsSubnet): RoadGraph {
  const adj: RoadGraph = new Map();
  const seen = new Set<string>();

  for (const re of subnet.network_edges ?? []) {
    const key = segmentKey(re.from_node_id, re.to_node_id);
    if (seen.has(key)) continue;
    seen.add(key);
    const w = Math.max(re.length_km || 1, 0.001);
    const a = re.from_node_id;
    const b = re.to_node_id;
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a)!.push({ neighbor: b, weight: w });
    adj.get(b)!.push({ neighbor: a, weight: w });
  }
  return adj;
}

function shortestPath(adj: RoadGraph, start: string, end: string): string[] | null {
  if (start === end) return [start];

  const dist = new Map<string, number>();
  const prev = new Map<string, string | null>();
  const heap: { d: number; u: string }[] = [{ d: 0, u: start }];
  dist.set(start, 0);
  prev.set(start, null);

  while (heap.length > 0) {
    heap.sort((x, y) => x.d - y.d);
    const { d, u } = heap.shift()!;
    if (d > (dist.get(u) ?? Infinity)) continue;
    if (u === end) break;

    for (const { neighbor: v, weight: w } of adj.get(u) ?? []) {
      const nd = d + w;
      if (nd < (dist.get(v) ?? Infinity)) {
        dist.set(v, nd);
        prev.set(v, u);
        heap.push({ d: nd, u: v });
      }
    }
  }

  if (!prev.has(end)) return null;

  const path: string[] = [];
  let cur: string | null = end;
  while (cur) {
    path.push(cur);
    cur = prev.get(cur) ?? null;
  }
  path.reverse();
  return path;
}

export function sandLogisticsToFlow(result: SandLogisticsSubnet): {
  nodes: Node<SandFlowNodeData>[];
  edges: Edge[];
  summary: { total_demand_m3: number; total_allocated_m3: number; unmet_m3: number };
} {
  const nodes: Node<SandFlowNodeData>[] = [];
  const edges: Edge[] = [];
  const quarryById = new Map(result.quarries.map((q) => [q.object_id, q]));
  const quarryIds = new Set(result.quarries.map((q) => q.object_id));
  const roadGraph = buildRoadGraph(result);

  const networkGeo: { lon: number; lat: number }[] = [];
  for (const nn of result.network_nodes ?? []) {
    if (!Number.isFinite(nn.lon) || !Number.isFinite(nn.lat)) continue;
    networkGeo.push({ lon: nn.lon, lat: nn.lat });
  }

  const siteSpecs: SiteSpec[] = [];
  for (const q of result.quarries) {
    if (!q.snap_node_id) continue;
    if (Number.isFinite(q.lon) && Number.isFinite(q.lat) && (q.lon !== 0 || q.lat !== 0)) {
      siteSpecs.push({
        id: quarryId(q.object_id),
        snapNodeId: q.snap_node_id,
        kind: 'quarry',
        lon: q.lon,
        lat: q.lat,
      });
      networkGeo.push({ lon: q.lon, lat: q.lat });
    }
  }
  for (const c of result.consumers) {
    if (!c.snap_node_id) continue;
    if (Number.isFinite(c.lon) && Number.isFinite(c.lat) && (c.lon !== 0 || c.lat !== 0)) {
      siteSpecs.push({
        id: consumerId(c.object_id),
        snapNodeId: c.snap_node_id,
        kind: 'consumer',
        lon: c.lon,
        lat: c.lat,
      });
      networkGeo.push({ lon: c.lon, lat: c.lat });
    }
  }

  const frame = buildGeoFrame(networkGeo);
  const positions = new Map<string, { x: number; y: number }>();

  const snapCenters = new Map<string, { cx: number; cy: number }>();

  let layoutSiteRects: LayoutRect[] = [];

  if (frame) {
    for (const nn of result.network_nodes ?? []) {
      if (!Number.isFinite(nn.lon) || !Number.isFinite(nn.lat)) continue;
      const id = networkNodeId(nn.id);
      const topLeft = geoToTopLeft(frame, nn.lon, nn.lat, NET_SIZE, NET_SIZE);
      positions.set(id, topLeft);
      snapCenters.set(nn.id, {
        cx: topLeft.x + NET_SIZE / 2,
        cy: topLeft.y + NET_SIZE / 2,
      });
    }

    const siteSnapIds = new Map<string, string>();
    const geoKeyById = new Map<string, string>();
    const siteSpecById = new Map<string, SiteSpec>();
    const siteRects: LayoutRect[] = siteSpecs.map((spec) => {
      siteSnapIds.set(spec.id, spec.snapNodeId);
      geoKeyById.set(spec.id, geoKey(spec.lon, spec.lat));
      siteSpecById.set(spec.id, spec);
      const anchor = siteGeoAnchor(frame, spec);
      return {
        id: spec.id,
        x: anchor.x,
        y: anchor.y,
        w: SITE_W,
        h: SITE_H,
        ax: anchor.x,
        ay: anchor.y,
      };
    });

    if (siteRects.length > 0) {
      const roadSegments = buildRoadSegments(result.network_edges, positions);
      const nodeCenters = [...snapCenters.values()];
      resolveSiteLayout(
        siteRects,
        roadSegments,
        nodeCenters,
        snapCenters,
        siteSnapIds,
        geoKeyById,
        frame,
        siteSpecById
      );
      layoutSiteRects = siteRects;
      for (const s of siteRects) {
        positions.set(s.id, { x: s.x, y: s.y });
      }
    }
  }

  for (const nn of result.network_nodes ?? []) {
    const id = networkNodeId(nn.id);
    const pos = positions.get(id);
    if (!pos) continue;
    nodes.push({
      id,
      type: 'sandNetworkNode',
      position: pos,
      zIndex: 1,
      selectable: false,
      draggable: false,
      data: { kind: 'network', label: '' },
    });
  }

  const segmentFlowM3 = new Map<string, number>();
  const siteLinks = new Set<string>();

  let totalDemand = 0;
  let totalAllocated = 0;

  for (const q of result.quarries) {
    if (!q.snap_node_id) continue;
    const id = quarryId(q.object_id);
    nodes.push({
      id,
      type: 'sandFlowNode',
      position: positions.get(id) ?? { x: 0, y: 0 },
      zIndex: 20,
      data: {
        kind: 'quarry',
        label: q.name || 'Карьер',
        in_service: q.in_service,
        lon: q.lon,
        lat: q.lat,
      },
    });
  }

  for (const c of result.consumers) {
    if (!c.snap_node_id) continue;
    totalDemand += c.demand_m3;
    totalAllocated += c.greedy_allocated_m3;
    const id = consumerId(c.object_id);
    nodes.push({
      id,
      type: 'sandFlowNode',
      position: positions.get(id) ?? { x: 0, y: 0 },
      zIndex: 20,
      data: {
        kind: 'consumer',
        label: c.name || c.subtype,
        in_service: c.in_service,
        lon: c.lon,
        lat: c.lat,
        demand_m3: c.demand_m3,
        allocated_m3: c.greedy_allocated_m3,
      },
    });

    if (
      !c.in_service ||
      !c.greedy_quarry_id ||
      !quarryIds.has(c.greedy_quarry_id) ||
      c.greedy_allocated_m3 <= 0
    ) {
      continue;
    }

    const quarry = quarryById.get(c.greedy_quarry_id);
    const qSnap = quarry?.snap_node_id;
    const cSnap = c.snap_node_id;
    if (!qSnap || !cSnap) continue;

    const path = shortestPath(roadGraph, qSnap, cSnap);
    if (!path || path.length < 1) continue;

    siteLinks.add(`${quarryId(c.greedy_quarry_id)}->${networkNodeId(qSnap)}`);
    siteLinks.add(`${networkNodeId(cSnap)}->${id}`);

    if (path.length === 1) {
      siteLinks.add(`${quarryId(c.greedy_quarry_id)}->${id}`);
      continue;
    }

    for (let i = 0; i < path.length - 1; i++) {
      const key = segmentKey(path[i]!, path[i + 1]!);
      segmentFlowM3.set(key, (segmentFlowM3.get(key) ?? 0) + c.greedy_allocated_m3);
    }
  }

  const roadSeen = new Set<string>();
  for (const re of result.network_edges ?? []) {
    const key = segmentKey(re.from_node_id, re.to_node_id);
    if (roadSeen.has(key)) continue;
    roadSeen.add(key);
    const flowM3 = segmentFlowM3.get(key) ?? 0;
    const hasFlow = flowM3 > 0;
    const srcPos = positions.get(networkNodeId(re.from_node_id));
    const tgtPos = positions.get(networkNodeId(re.to_node_id));
    const labelOffset =
      hasFlow && srcPos && tgtPos
        ? flowLabelOffset(
            srcPos.x + NET_SIZE / 2,
            srcPos.y + NET_SIZE / 2,
            tgtPos.x + NET_SIZE / 2,
            tgtPos.y + NET_SIZE / 2,
            flowM3,
            layoutSiteRects
          )
        : { labelOffsetX: 0, labelOffsetY: 0 };
    edges.push({
      id: `road-${key}`,
      type: 'sandRoadEdge',
      source: networkNodeId(re.from_node_id),
      target: networkNodeId(re.to_node_id),
      selectable: false,
      zIndex: hasFlow ? 5 : 0,
      data: {
        flowM3,
        ...labelOffset,
      } satisfies SandRoadEdgeData,
      style: hasFlow
        ? { stroke: '#b45309', strokeWidth: 4 }
        : { stroke: '#cbd5e1', strokeWidth: 2 },
    });
  }

  for (const linkKey of siteLinks) {
    const arrow = linkKey.indexOf('->');
    if (arrow < 0) continue;
    const source = linkKey.slice(0, arrow);
    const target = linkKey.slice(arrow + 2);
    edges.push({
      id: `link-${source}-${target}`,
      type: 'sandSiteLinkEdge',
      source,
      target,
      zIndex: 4,
      style: { stroke: '#d97706', strokeWidth: 1.5, strokeDasharray: '5 4' },
    });
  }

  return {
    nodes,
    edges,
    summary: {
      total_demand_m3: totalDemand,
      total_allocated_m3: totalAllocated,
      unmet_m3: Math.max(0, totalDemand - totalAllocated),
    },
  };
}
