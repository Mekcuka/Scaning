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
  /** Только потребители: спрос и жадная отгрузка для цвета блока */
  demand_m3?: number;
  allocated_m3?: number;
};

export type SandFlowEdgeData = {
  flowM3?: number;
  variant: 'road' | 'flow' | 'site-link';
  showLabel?: boolean;
};

const SITE_W = 160;
const SITE_H = 68;
const NET_SIZE = 10;
const LAYOUT_W = 1600;
const LAYOUT_H = 1000;
const PADDING = 80;
const SITE_GAP = 44;
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

type LayoutPoint = { id: string; lon: number; lat: number; w: number; h: number };

function computeGeoPositions(points: LayoutPoint[]): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  if (points.length === 0) return positions;

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

  const spanLon = Math.max(maxLon - minLon, MIN_GEO_SPAN);
  const spanLat = Math.max(maxLat - minLat, MIN_GEO_SPAN);
  const innerW = LAYOUT_W - 2 * PADDING;
  const innerH = LAYOUT_H - 2 * PADDING;
  const scale = Math.min(innerW / spanLon, innerH / spanLat) * 0.92;
  const usedW = spanLon * scale;
  const usedH = spanLat * scale;
  const offsetX = PADDING + (innerW - usedW) / 2;
  const offsetY = PADDING + (innerH - usedH) / 2;

  for (const p of points) {
    positions.set(p.id, {
      x: offsetX + (p.lon - minLon) * scale - p.w / 2,
      y: offsetY + (maxLat - p.lat) * scale - p.h / 2,
    });
  }
  return positions;
}

type LayoutRect = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  ax: number;
  ay: number;
  isSite: boolean;
};

function spreadCoincidentSites(state: LayoutRect[]): void {
  const groups = new Map<string, LayoutRect[]>();
  for (const s of state) {
    if (!s.isSite) continue;
    const key = `${Math.round(s.ax)}:${Math.round(s.ay)}`;
    const list = groups.get(key) ?? [];
    list.push(s);
    groups.set(key, list);
  }

  for (const group of groups.values()) {
    if (group.length <= 1) continue;
    const radius = SITE_W + SITE_GAP;
    group.forEach((s, i) => {
      const angle = (2 * Math.PI * i) / group.length - Math.PI / 2;
      const cx = s.ax + s.w / 2;
      const cy = s.ay + s.h / 2;
      s.x = cx + Math.cos(angle) * radius - s.w / 2;
      s.y = cy + Math.sin(angle) * radius - s.h / 2;
    });
  }
}

function pushRectsApart(a: LayoutRect, b: LayoutRect, gap: number): void {
  const acx = a.x + a.w / 2;
  const acy = a.y + a.h / 2;
  const bcx = b.x + b.w / 2;
  const bcy = b.y + b.h / 2;
  const overlapX = (a.w + b.w) / 2 + gap - Math.abs(acx - bcx);
  const overlapY = (a.h + b.h) / 2 + gap - Math.abs(acy - bcy);
  if (overlapX <= 0 || overlapY <= 0) return;

  let dx = acx - bcx;
  let dy = acy - bcy;
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) {
    dx = a.id.localeCompare(b.id) || 1;
    dy = 1;
  }
  const len = Math.hypot(dx, dy) || 1;
  const push = Math.min(overlapX, overlapY) / 2 + 3;

  const aMovable = a.isSite;
  const bMovable = b.isSite;
  if (!aMovable && !bMovable) return;

  if (aMovable && bMovable) {
    a.x += (dx / len) * push;
    a.y += (dy / len) * push;
    b.x -= (dx / len) * push;
    b.y -= (dy / len) * push;
  } else if (aMovable) {
    a.x += (dx / len) * push * 2;
    a.y += (dy / len) * push * 2;
  } else {
    b.x -= (dx / len) * push * 2;
    b.y -= (dy / len) * push * 2;
  }
}

/** Push overlapping blocks apart; sites stay near geo anchors, network nodes stay fixed. */
function resolveLayoutOverlaps(
  positions: Map<string, { x: number; y: number }>,
  anchors: Map<string, { x: number; y: number }>,
  layoutPoints: LayoutPoint[],
  siteIds: Set<string>
): void {
  if (layoutPoints.length < 2) return;

  const state: LayoutRect[] = layoutPoints.map((p) => {
    const pos = positions.get(p.id) ?? { x: 0, y: 0 };
    const anchor = anchors.get(p.id) ?? pos;
    return {
      id: p.id,
      x: pos.x,
      y: pos.y,
      w: p.w,
      h: p.h,
      ax: anchor.x,
      ay: anchor.y,
      isSite: siteIds.has(p.id),
    };
  });

  spreadCoincidentSites(state);

  for (let iter = 0; iter < 280; iter++) {
    for (let i = 0; i < state.length; i++) {
      for (let j = i + 1; j < state.length; j++) {
        pushRectsApart(state[i]!, state[j]!, SITE_GAP);
      }
    }
    const pull = iter < 200 ? 0.035 : 0.012;
    for (const s of state) {
      if (!s.isSite) continue;
      s.x += (s.ax + s.w / 2 - (s.x + s.w / 2)) * pull;
      s.y += (s.ay + s.h / 2 - (s.y + s.h / 2)) * pull;
    }
  }

  for (const s of state) {
    positions.set(s.id, { x: s.x, y: s.y });
  }
}

type RoadGraph = Map<string, { neighbor: string; weight: number }[]>;

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

  const layoutPoints: LayoutPoint[] = [];
  const siteIds: string[] = [];

  for (const nn of result.network_nodes ?? []) {
    if (!Number.isFinite(nn.lon) || !Number.isFinite(nn.lat)) continue;
    layoutPoints.push({
      id: networkNodeId(nn.id),
      lon: nn.lon,
      lat: nn.lat,
      w: NET_SIZE,
      h: NET_SIZE,
    });
  }

  for (const q of result.quarries) {
    if (!q.snap_node_id) continue;
    if (Number.isFinite(q.lon) && Number.isFinite(q.lat) && (q.lon !== 0 || q.lat !== 0)) {
      const id = quarryId(q.object_id);
      siteIds.push(id);
      layoutPoints.push({ id, lon: q.lon, lat: q.lat, w: SITE_W, h: SITE_H });
    }
  }

  for (const c of result.consumers) {
    if (!c.snap_node_id) continue;
    if (Number.isFinite(c.lon) && Number.isFinite(c.lat) && (c.lon !== 0 || c.lat !== 0)) {
      const id = consumerId(c.object_id);
      siteIds.push(id);
      layoutPoints.push({ id, lon: c.lon, lat: c.lat, w: SITE_W, h: SITE_H });
    }
  }

  const siteIdSet = new Set(siteIds);
  const anchors = computeGeoPositions(layoutPoints);
  const positions = new Map(anchors);
  resolveLayoutOverlaps(positions, anchors, layoutPoints, siteIdSet);

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

  const roadSeen = new Set<string>();
  for (const re of result.network_edges ?? []) {
    const key = segmentKey(re.from_node_id, re.to_node_id);
    if (roadSeen.has(key)) continue;
    roadSeen.add(key);
    edges.push({
      id: `road-${key}`,
      type: 'sandNetworkEdge',
      source: networkNodeId(re.from_node_id),
      target: networkNodeId(re.to_node_id),
      selectable: false,
      zIndex: 0,
      style: { stroke: '#cbd5e1', strokeWidth: 2 },
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
      zIndex: 10,
      data: {
        kind: 'quarry',
        label: q.name || 'Карьер',
        in_service: q.in_service,
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
      zIndex: 10,
      data: {
        kind: 'consumer',
        label: c.name || c.subtype,
        in_service: c.in_service,
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

  for (const [key, flowM3] of segmentFlowM3) {
    const [a, b] = key.split('|');
    if (!a || !b) continue;
    edges.push({
      id: `flow-${key}`,
      type: 'sandFlowEdge',
      source: networkNodeId(a),
      target: networkNodeId(b),
      zIndex: 5,
      data: {
        flowM3,
        variant: 'flow',
        showLabel: flowM3 > 0,
      } satisfies SandFlowEdgeData,
      style: { stroke: '#b45309', strokeWidth: 4 },
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
