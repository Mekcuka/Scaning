import {
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  Position,
  type Edge,
  type Node,
} from '@xyflow/react';
import type { SandLogisticsConsumerRow, SandLogisticsQuarryRow, SandLogisticsSubnet } from './api';
import { entryYearFromIso } from './sandLogisticsNodeVisual';

export type SandLogisticsLineStyle = 'straight' | 'bezier' | 'smoothstep';

/** How volume labels are shown on the sand logistics schematic. */
export type SandLogisticsEdgeLabelMode = 'all' | 'key' | 'hidden';

/** Which objects appear on the sand logistics schematic. */
export type SandLogisticsNodeFilterMode = 'all_planned' | 'in_service' | 'allocated_only';

export const SAND_LOGISTICS_NODE_FILTER_OPTIONS: {
  value: SandLogisticsNodeFilterMode;
  label: string;
}[] = [
  { value: 'all_planned', label: 'Все с планом' },
  { value: 'in_service', label: 'Только введённые' },
  { value: 'allocated_only', label: 'С отгрузкой' },
];

export const SAND_LOGISTICS_LINE_STYLE_OPTIONS: {
  value: SandLogisticsLineStyle;
  label: string;
}[] = [
  { value: 'straight', label: 'Прямые' },
  { value: 'bezier', label: 'Изгибы' },
  { value: 'smoothstep', label: 'Ступеньки' },
];

export const SAND_LOGISTICS_EDGE_LABEL_MODE_OPTIONS: {
  value: SandLogisticsEdgeLabelMode;
  label: string;
}[] = [
  { value: 'key', label: 'Ключевые (плечо)' },
  { value: 'all', label: 'Все сегменты' },
  { value: 'hidden', label: 'Скрыть' },
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

/** SVG-путь по цепочке точек (упрощённая линия сети). */
export function polylineToSvgPath(
  style: SandLogisticsLineStyle,
  points: { x: number; y: number }[],
): [path: string, labelX: number, labelY: number] {
  if (points.length < 2) return ['', 0, 0];
  const mid = polylineMidpoint(points);

  if (style === 'straight') {
    const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    return [path, mid.x, mid.y];
  }

  let path = '';
  for (let i = 0; i < points.length - 1; i++) {
    const [segPath] = computeSandEdgePath(style, {
      sourceX: points[i]!.x,
      sourceY: points[i]!.y,
      targetX: points[i + 1]!.x,
      targetY: points[i + 1]!.y,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    });
    if (i === 0) {
      path = segPath;
      continue;
    }
    const lIdx = segPath.indexOf('L');
    const cIdx = segPath.indexOf('C');
    if (cIdx >= 0) {
      path += ` ${segPath.slice(cIdx)}`;
    } else if (lIdx >= 0) {
      path += ` ${segPath.slice(lIdx)}`;
    } else {
      path += ` L ${points[i + 1]!.x} ${points[i + 1]!.y}`;
    }
  }
  return [path, mid.x, mid.y];
}

export type SandFlowNodeKind = 'quarry' | 'consumer' | 'network';

export type SandFlowNodeData = {
  kind: SandFlowNodeKind;
  label: string;
  in_service?: boolean;
  lon?: number;
  lat?: number;
  as_of?: string;
  entry_date?: string;
  /** Только потребители: спрос и жадная отгрузка для цвета блока */
  demand_m3?: number;
  demand_plan_total_m3?: number;
  allocated_m3?: number;
  /** Карьер: остаток и начальный объём на дату среза */
  remaining_m3?: number;
  initial_m3?: number;
  /** Якорь сети без видимой вершины (развилка / snap). */
  hiddenAnchor?: boolean;
};

export type SandRoadEdgeData = {
  flowM3?: number;
  labelOffsetX?: number;
  labelOffsetY?: number;
  planned?: boolean;
};

/** Упрощённая полилиния сети (цепочка без промежуточных вершин). */
export type SandRoadPolylineEdgeData = SandRoadEdgeData & {
  points: { x: number; y: number }[];
};

export type SandLegLabelNodeData = {
  kind: 'legLabel';
  flowM3: number;
};

export type SandPlannedLegLabelNodeData = {
  kind: 'plannedLegLabel';
  label: string;
};

export type SandLogisticsFlowOptions = {
  edgeLabelMode?: SandLogisticsEdgeLabelMode;
  nodeFilter?: SandLogisticsNodeFilterMode;
  showPlannedRoutes?: boolean;
  groupByEntryYear?: boolean;
  as_of?: string;
};

export type SandLogisticsFlowResult = {
  nodes: Node<SandFlowNodeData | SandLegLabelNodeData | SandPlannedLegLabelNodeData>[];
  edges: Edge[];
  summary: { total_demand_m3: number; total_allocated_m3: number; unmet_m3: number };
  entryYears: number[];
  /** Id карьеров и потребителей на схеме — для fitView по объектам. */
  siteNodeIds: string[];
  /** Начальный viewport, вписывающий объекты (не зависит от async fitView). */
  defaultViewport: { x: number; y: number; zoom: number };
};

export type SandLogisticsRoadGraph = Map<string, { neighbor: string; weight: number }[]>;

export type SandLogisticsLayoutResult = {
  topologyKey: string;
  positions: Map<string, { x: number; y: number }>;
  siteNodeIds: string[];
  defaultViewport: { x: number; y: number; zoom: number };
  roadGraph: SandLogisticsRoadGraph;
  keyNetworkNodes: Set<string>;
  layoutSiteRects: SandFlowLayoutRect[];
  entryYears: number[];
  siteSpecs: SiteSpec[];
};

export type SandLogisticsLayoutOptions = Pick<
  SandLogisticsFlowOptions,
  'nodeFilter' | 'groupByEntryYear'
>;

/** Стабильный ключ топологии подсети (без slice-полей in_service / объёмов). */
export function computeSandLogisticsTopologyKey(subnet: SandLogisticsSubnet): string {
  return JSON.stringify({
    subnet_index: subnet.subnet_index,
    network_nodes: subnet.network_nodes,
    network_edges: subnet.network_edges,
    quarries: subnet.quarries.map((q) => ({
      object_id: q.object_id,
      lon: q.lon,
      lat: q.lat,
      snap_node_id: q.snap_node_id,
      entry_date: q.entry_date,
    })),
    consumers: subnet.consumers.map((c) => ({
      object_id: c.object_id,
      lon: c.lon,
      lat: c.lat,
      snap_node_id: c.snap_node_id,
      entry_date: c.entry_date,
    })),
  });
}

/** Компактный ключ slice-данных для инвалидации пересчёта потоков. */
export function computeSandLogisticsSliceKey(
  subnet: SandLogisticsSubnet,
  asOf?: string,
): string {
  const parts: string[] = [asOf ?? ''];
  for (const q of subnet.quarries) {
    parts.push(
      `q:${q.object_id}:${q.in_service ? 1 : 0}:${q.greedy_allocated_m3}:${q.greedy_remaining_m3}`,
    );
  }
  for (const c of subnet.consumers) {
    parts.push(
      `c:${c.object_id}:${c.in_service ? 1 : 0}:${c.demand_m3}:${c.greedy_allocated_m3}:${c.greedy_quarry_id ?? ''}`,
    );
  }
  return parts.join('|');
}

export function mergeSliceFlowNodes(
  prev: Node<SandFlowNodeData | SandLegLabelNodeData | SandPlannedLegLabelNodeData>[],
  next: Node<SandFlowNodeData | SandLegLabelNodeData | SandPlannedLegLabelNodeData>[],
): Node<SandFlowNodeData | SandLegLabelNodeData | SandPlannedLegLabelNodeData>[] {
  const prevById = new Map(prev.map((n) => [n.id, n]));
  return next.map((node) => {
    if (node.type !== 'sandFlowNode') return node;
    const existing = prevById.get(node.id);
    if (existing?.type === 'sandFlowNode') {
      return { ...node, position: existing.position };
    }
    return node;
  });
}

const YEAR_LANE_SPACING = 36;

export function shouldShowQuarryOnSchematic(
  q: SandLogisticsQuarryRow,
  filter: SandLogisticsNodeFilterMode,
): boolean {
  if (!q.snap_node_id) return false;
  switch (filter) {
    case 'all_planned':
      return true;
    case 'in_service':
      return q.in_service;
    case 'allocated_only':
      return q.in_service || q.greedy_allocated_m3 > 0;
  }
}

export function shouldShowConsumerOnSchematic(
  c: SandLogisticsConsumerRow,
  filter: SandLogisticsNodeFilterMode,
): boolean {
  if (!c.snap_node_id) return false;
  switch (filter) {
    case 'all_planned':
      return true;
    case 'in_service':
      return c.in_service;
    case 'allocated_only':
      return c.greedy_allocated_m3 > 0;
  }
}

const SITE_W = 160;
const SITE_H = 68;
const SITE_GAP = 10;
export const SAND_FLOW_SITE_W = SITE_W;
export const SAND_FLOW_SITE_H = SITE_H;
export const SAND_FLOW_SITE_GAP = SITE_GAP;
const NET_SIZE = 10;
export const SAND_FLOW_NET_SIZE = NET_SIZE;
const LAYOUT_W = 1600;
const LAYOUT_H = 1000;
const PADDING = 80;
const ROAD_CLEARANCE = 24;
const ROAD_CLEARANCE_FINAL = 26;
const NODE_CLEARANCE_BASE = 52;
const GEO_PULL = 0.06;
const FINAL_GEO_PULL = 0.32;
const NODE_REPEL_RADIUS_PX = 140;
const GEO_FRAME_MARGIN = 0.14;
const MIN_GEO_SPAN = 0.006;

export const SAND_FLOW_MAX_GEO_DRIFT = Math.min(220, 0.12 * Math.min(LAYOUT_W, LAYOUT_H));

const DEFAULT_FLOW_VIEWPORT_PAD = 0.1;
const DEFAULT_FLOW_VIEWPORT_MAX_ZOOM = 1.5;

export type SandSiteDensitySpread = {
  geoScaleBoost: number;
  layoutGap: number;
  maxDrift: number;
  geoMargin: number;
};

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

function applyGeoFrameScaleBoost(frame: GeoFrame, boost: number): void {
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

const DEFAULT_FLOW_VIEWPORT_W = 720;
const DEFAULT_FLOW_VIEWPORT_H = 520;

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

function adaptiveNodeClearance(siteCount: number): number {
  const scale = Math.sqrt(siteCount / 6);
  const clamped = Math.max(0.75, Math.min(1.15, scale));
  return NODE_CLEARANCE_BASE * clamped;
}

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

/** Midpoint along a polyline by arc length (for haul-leg labels). */
export function polylineMidpoint(points: { x: number; y: number }[]): { x: number; y: number } {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return { ...points[0]! };

  let totalLen = 0;
  const segLens: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const len = Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y);
    segLens.push(len);
    totalLen += len;
  }
  if (totalLen < 1e-6) return { ...points[0]! };

  let remaining = totalLen / 2;
  for (let i = 0; i < segLens.length; i++) {
    const segLen = segLens[i]!;
    if (remaining <= segLen) {
      const t = remaining / segLen;
      return {
        x: points[i]!.x + t * (points[i + 1]!.x - points[i]!.x),
        y: points[i]!.y + t * (points[i + 1]!.y - points[i]!.y),
      };
    }
    remaining -= segLen;
  }
  return { ...points[points.length - 1]! };
}

function siteCenter(pos: { x: number; y: number }, w: number, h: number): { x: number; y: number } {
  return { x: pos.x + w / 2, y: pos.y + h / 2 };
}

function networkCenter(pos: { x: number; y: number }): { x: number; y: number } {
  return { x: pos.x + NET_SIZE / 2, y: pos.y + NET_SIZE / 2 };
}

/** Centers along quarry → road nodes → consumer for one greedy haul leg. */
export function haulLegPolylinePoints(
  pathNodeIds: string[],
  quarrySiteId: string,
  consumerSiteId: string,
  positions: Map<string, { x: number; y: number }>,
): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  const qPos = positions.get(quarrySiteId);
  if (qPos) points.push(siteCenter(qPos, SITE_W, SITE_H));
  for (const nodeId of pathNodeIds) {
    const p = positions.get(networkNodeId(nodeId));
    if (p) points.push(networkCenter(p));
  }
  const cPos = positions.get(consumerSiteId);
  if (cPos) points.push(siteCenter(cPos, SITE_W, SITE_H));
  return points;
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
  entryYear: number | null;
};

function buildGeoFrame(
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

/** Узлы сети, влияющие на раскладку: пути между snap-точками объектов. */
export function collectSiteInfluenceNodeIds(
  siteSpecs: SiteSpec[],
  roadGraph: RoadGraph,
): Set<string> {
  const snapIds = [...new Set(siteSpecs.map((s) => s.snapNodeId))];
  const influence = new Set<string>(snapIds);

  for (let i = 0; i < snapIds.length; i++) {
    for (let j = i + 1; j < snapIds.length; j++) {
      const path = shortestPath(roadGraph, snapIds[i]!, snapIds[j]!);
      if (path) {
        for (const nodeId of path) influence.add(nodeId);
      }
    }
  }

  return influence;
}

/** Сегменты дорог только в зоне влияния объектов. */
export function buildLayoutRoadSegments(
  networkEdges: SandLogisticsSubnet['network_edges'],
  positions: Map<string, { x: number; y: number }>,
  influenceNodeIds: Set<string>,
): RoadSegment[] {
  const segments: RoadSegment[] = [];
  const seen = new Set<string>();
  for (const re of networkEdges ?? []) {
    if (!influenceNodeIds.has(re.from_node_id) || !influenceNodeIds.has(re.to_node_id)) continue;
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

/** Вершины сети, от которых отталкивается блок (без own snap, в радиусе). */
export function filterNodeCentersForSite(
  snapCenters: Map<string, { cx: number; cy: number }>,
  influenceNodeIds: Set<string>,
  siteAnchorCx: number,
  siteAnchorCy: number,
  ownSnapId: string | undefined,
  maxRadiusPx: number,
): { cx: number; cy: number }[] {
  const result: { cx: number; cy: number }[] = [];
  for (const [nodeId, center] of snapCenters) {
    if (!influenceNodeIds.has(nodeId)) continue;
    if (nodeId === ownSnapId) continue;
    const dist = Math.hypot(center.cx - siteAnchorCx, center.cy - siteAnchorCy);
    if (dist > maxRadiusPx) continue;
    result.push(center);
  }
  return result;
}

/** Расстояние центров блоков от geo-якорей (для тестов). */
export function computeSandFlowSiteAnchorDrifts(
  siteRects: Pick<LayoutRect, 'x' | 'y' | 'w' | 'h' | 'ax' | 'ay'>[],
): number[] {
  return siteRects.map((s) => {
    const cx = s.x + s.w / 2;
    const cy = s.y + s.h / 2;
    const ax = s.ax + s.w / 2;
    const ay = s.ay + s.h / 2;
    return Math.hypot(cx - ax, cy - ay);
  });
}

/** Drift site-узлов схемы от geo-якорей (для регрессионных тестов раскладки). */
export function measureSandFlowGeoDrifts(
  subnet: SandLogisticsSubnet,
  options?: SandLogisticsFlowOptions,
): number[] {
  const flow = sandLogisticsToFlow(subnet, options);
  const nodeFilter = options?.nodeFilter ?? 'all_planned';
  const siteSpecs: SiteSpec[] = [];
  for (const q of subnet.quarries.filter((row) => shouldShowQuarryOnSchematic(row, nodeFilter))) {
    if (!q.snap_node_id) continue;
    if (Number.isFinite(q.lon) && Number.isFinite(q.lat) && (q.lon !== 0 || q.lat !== 0)) {
      siteSpecs.push({
        id: quarryId(q.object_id),
        snapNodeId: q.snap_node_id,
        kind: 'quarry',
        lon: q.lon,
        lat: q.lat,
        entryYear: entryYearFromIso(q.entry_date),
      });
    }
  }
  for (const c of subnet.consumers.filter((row) => shouldShowConsumerOnSchematic(row, nodeFilter))) {
    if (!c.snap_node_id) continue;
    if (Number.isFinite(c.lon) && Number.isFinite(c.lat) && (c.lon !== 0 || c.lat !== 0)) {
      siteSpecs.push({
        id: consumerId(c.object_id),
        snapNodeId: c.snap_node_id,
        kind: 'consumer',
        lon: c.lon,
        lat: c.lat,
        entryYear: entryYearFromIso(c.entry_date),
      });
    }
  }

  const density = computeSiteDensitySpread(siteSpecs.length);
  const frame = buildGeoFrame(
    buildGeoFramePointsForSites(siteSpecs, subnet.network_nodes),
    density.geoMargin,
  );
  if (!frame) return [];
  applyGeoFrameScaleBoost(frame, density.geoScaleBoost);

  const drifts: number[] = [];
  for (const node of flow.nodes.filter((n) => n.type === 'sandFlowNode')) {
    const data = node.data as SandFlowNodeData;
    if (!Number.isFinite(data.lon) || !Number.isFinite(data.lat)) continue;
    const anchor = geoToTopLeft(frame, data.lon!, data.lat!, SITE_W, SITE_H);
    const cx = node.position.x + SITE_W / 2;
    const cy = node.position.y + SITE_H / 2;
    const ax = anchor.x + SITE_W / 2;
    const ay = anchor.y + SITE_H / 2;
    drifts.push(Math.hypot(cx - ax, cy - ay));
  }

  return drifts;
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

function clampToGeoAnchor(s: LayoutRect, maxDrift: number = SAND_FLOW_MAX_GEO_DRIFT): void {
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

type RoadGraph = Map<string, { neighbor: string; weight: number }[]>;

/** Разводит блоки, сохраняя привязку к гео-якорю (lon/lat). */
function resolveSiteLayout(
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

export type SimplifiedRoadPolyline = {
  id: string;
  nodeIds: string[];
  points: { x: number; y: number }[];
  segmentKeys: string[];
};

/** Узлы-развилки и snap-точки объектов — концы упрощённых полилиний. */
export function collectKeyNetworkNodes(
  adj: RoadGraph,
  snapNodeIds: Iterable<string>,
): Set<string> {
  const keys = new Set<string>(snapNodeIds);
  for (const [nodeId, neighbors] of adj) {
    if (neighbors.length !== 2) keys.add(nodeId);
  }
  return keys;
}

/** Схлопывает цепочки узлов степени 2 в одну полилинию между ключевыми узлами. */
export function simplifyRoadNetworkPolylines(
  adj: RoadGraph,
  keyNodes: Set<string>,
  positions: Map<string, { x: number; y: number }>,
): SimplifiedRoadPolyline[] {
  const usedEdges = new Set<string>();
  const polylines: SimplifiedRoadPolyline[] = [];
  let polyIndex = 0;

  const isUsed = (a: string, b: string) => usedEdges.has(segmentKey(a, b));
  const markUsed = (a: string, b: string) => {
    usedEdges.add(segmentKey(a, b));
  };

  const centerFor = (nodeId: string): { x: number; y: number } | null => {
    const pos = positions.get(networkNodeId(nodeId));
    return pos ? networkCenter(pos) : null;
  };

  const sortedKeys = [...keyNodes].sort();

  for (const start of sortedKeys) {
    for (const { neighbor } of adj.get(start) ?? []) {
      if (isUsed(start, neighbor)) continue;

      const pathNodes = [start];
      markUsed(start, neighbor);
      let prev = start;
      let cur = neighbor;

      while (!keyNodes.has(cur)) {
        pathNodes.push(cur);
        const nextCandidates = (adj.get(cur) ?? [])
          .map((e) => e.neighbor)
          .filter((n) => n !== prev);
        if (nextCandidates.length !== 1) break;
        const next = nextCandidates[0]!;
        if (isUsed(cur, next)) break;
        markUsed(cur, next);
        prev = cur;
        cur = next;
      }
      pathNodes.push(cur);

      const points = pathNodes
        .map((nid) => centerFor(nid))
        .filter((p): p is { x: number; y: number } => p != null);
      if (points.length < 2) continue;

      const segmentKeys: string[] = [];
      for (let i = 0; i < pathNodes.length - 1; i++) {
        segmentKeys.push(segmentKey(pathNodes[i]!, pathNodes[i + 1]!));
      }

      polylines.push({
        id: `${polyIndex++}:${pathNodes[0]}:${pathNodes[pathNodes.length - 1]}`,
        nodeIds: pathNodes,
        points,
        segmentKeys,
      });
    }
  }

  for (const [a, neighbors] of adj) {
    for (const { neighbor: b } of neighbors) {
      if (isUsed(a, b)) continue;
      markUsed(a, b);
      const pa = centerFor(a);
      const pb = centerFor(b);
      if (!pa || !pb) continue;
      polylines.push({
        id: `${polyIndex++}:${a}:${b}`,
        nodeIds: [a, b],
        points: [pa, pb],
        segmentKeys: [segmentKey(a, b)],
      });
    }
  }

  return polylines;
}

function createHiddenNetworkAnchorNode(
  id: string,
  position: { x: number; y: number },
): Node<SandFlowNodeData> {
  return {
    id,
    type: 'sandNetworkNode',
    position,
    zIndex: 1,
    selectable: false,
    draggable: false,
    className: 'nopan nodrag',
    data: { kind: 'network', label: '', hiddenAnchor: true },
  };
}

function resolveNetworkAnchorPosition(
  schematicId: string,
  positions: Map<string, { x: number; y: number }>,
  siteSpecs: SiteSpec[],
): { x: number; y: number } | null {
  const existing = positions.get(schematicId);
  if (existing) return existing;
  if (!schematicId.startsWith('n:')) return null;
  const rawSnap = schematicId.slice(2);
  for (const spec of siteSpecs) {
    if (spec.snapNodeId !== rawSnap) continue;
    const sitePos = positions.get(spec.id);
    if (!sitePos) continue;
    return {
      x: sitePos.x + SITE_W / 2 - NET_SIZE / 2,
      y: sitePos.y + SITE_H / 2 - NET_SIZE / 2,
    };
  }
  return null;
}

/** React Flow требует узел на каждом конце ребра — создаём скрытые якоря, если их ещё нет. */
export function ensureSchematicEndpointNodes(
  nodes: Node<SandFlowNodeData | SandLegLabelNodeData | SandPlannedLegLabelNodeData>[],
  edges: Edge[],
  positions: Map<string, { x: number; y: number }>,
  siteSpecs: SiteSpec[],
): void {
  const known = new Set(nodes.map((n) => n.id));
  for (const edge of edges) {
    for (const endpoint of [edge.source, edge.target]) {
      if (!endpoint || known.has(endpoint)) continue;
      const pos =
        resolveNetworkAnchorPosition(endpoint, positions, siteSpecs) ??
        positions.get(endpoint) ?? { x: 0, y: 0 };
      positions.set(endpoint, pos);
      nodes.push(createHiddenNetworkAnchorNode(endpoint, pos));
      known.add(endpoint);
    }
  }
}

function applyEntryYearLaneOffset(
  positions: Map<string, { x: number; y: number }>,
  siteSpecs: SiteSpec[],
  enabled: boolean,
): number[] {
  const years = [
    ...new Set(
      siteSpecs
        .map((s) => s.entryYear)
        .filter((y): y is number => y != null),
    ),
  ].sort((a, b) => a - b);

  if (!enabled || years.length < 2) return years;

  const midIndex = (years.length - 1) / 2;
  const yearIndex = new Map(years.map((y, i) => [y, i]));

  for (const spec of siteSpecs) {
    if (spec.entryYear == null) continue;
    const idx = yearIndex.get(spec.entryYear);
    if (idx == null) continue;
    const pos = positions.get(spec.id);
    if (!pos) continue;
    pos.y += (idx - midIndex) * YEAR_LANE_SPACING;
  }

  return years;
}

export function buildSandLogisticsLayout(
  result: SandLogisticsSubnet,
  options?: SandLogisticsLayoutOptions,
): SandLogisticsLayoutResult {
  const nodeFilter = options?.nodeFilter ?? 'all_planned';
  const groupByEntryYear = options?.groupByEntryYear ?? false;

  const visibleQuarries = result.quarries.filter((q) => shouldShowQuarryOnSchematic(q, nodeFilter));
  const visibleConsumers = result.consumers.filter((c) =>
    shouldShowConsumerOnSchematic(c, nodeFilter),
  );

  const roadGraph = buildRoadGraph(result);

  const siteSpecs: SiteSpec[] = [];
  for (const q of visibleQuarries) {
    if (!q.snap_node_id) continue;
    if (Number.isFinite(q.lon) && Number.isFinite(q.lat) && (q.lon !== 0 || q.lat !== 0)) {
      siteSpecs.push({
        id: quarryId(q.object_id),
        snapNodeId: q.snap_node_id,
        kind: 'quarry',
        lon: q.lon,
        lat: q.lat,
        entryYear: entryYearFromIso(q.entry_date),
      });
    }
  }
  for (const c of visibleConsumers) {
    if (!c.snap_node_id) continue;
    if (Number.isFinite(c.lon) && Number.isFinite(c.lat) && (c.lon !== 0 || c.lat !== 0)) {
      siteSpecs.push({
        id: consumerId(c.object_id),
        snapNodeId: c.snap_node_id,
        kind: 'consumer',
        lon: c.lon,
        lat: c.lat,
        entryYear: entryYearFromIso(c.entry_date),
      });
    }
  }

  const density = computeSiteDensitySpread(siteSpecs.length);
  const frameGeoPoints = buildGeoFramePointsForSites(siteSpecs, result.network_nodes);
  const frame = buildGeoFrame(frameGeoPoints, density.geoMargin);
  const positions = new Map<string, { x: number; y: number }>();

  if (frame) {
    applyGeoFrameScaleBoost(frame, density.geoScaleBoost);
  }

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
      const influenceNodeIds = collectSiteInfluenceNodeIds(siteSpecs, roadGraph);
      const roadSegments = buildLayoutRoadSegments(result.network_edges, positions, influenceNodeIds);
      resolveSiteLayout(
        siteRects,
        roadSegments,
        snapCenters,
        siteSnapIds,
        geoKeyById,
        frame,
        siteSpecById,
        influenceNodeIds,
        density,
      );
      layoutSiteRects = siteRects;
      for (const s of siteRects) {
        positions.set(s.id, { x: s.x, y: s.y });
      }
    }
  }

  const entryYears = applyEntryYearLaneOffset(positions, siteSpecs, groupByEntryYear);

  const snapNodeIds = new Set<string>();
  for (const q of visibleQuarries) {
    if (q.snap_node_id) snapNodeIds.add(q.snap_node_id);
  }
  for (const c of visibleConsumers) {
    if (c.snap_node_id) snapNodeIds.add(c.snap_node_id);
  }
  const keyNetworkNodes = collectKeyNetworkNodes(roadGraph, snapNodeIds);

  const siteNodeIds: string[] = [];
  for (const q of visibleQuarries) {
    if (!q.snap_node_id) continue;
    siteNodeIds.push(quarryId(q.object_id));
  }
  for (const c of visibleConsumers) {
    if (!c.snap_node_id) continue;
    siteNodeIds.push(consumerId(c.object_id));
  }

  const layoutNodesForViewport = siteNodeIds.map((id) => ({
    id,
    position: positions.get(id) ?? { x: 0, y: 0 },
  }));
  const defaultViewport = computeSandFlowDefaultViewport(layoutNodesForViewport, siteNodeIds);

  return {
    topologyKey: computeSandLogisticsTopologyKey(result),
    positions,
    siteNodeIds,
    defaultViewport,
    roadGraph,
    keyNetworkNodes,
    layoutSiteRects: layoutSiteRects.map((r) => ({
      id: r.id,
      x: r.x,
      y: r.y,
      w: r.w,
      h: r.h,
    })),
    entryYears,
    siteSpecs,
  };
}

export function buildSandLogisticsSliceFlow(
  layout: SandLogisticsLayoutResult,
  result: SandLogisticsSubnet,
  options?: SandLogisticsFlowOptions,
): SandLogisticsFlowResult {
  const edgeLabelMode = options?.edgeLabelMode ?? 'key';
  const nodeFilter = options?.nodeFilter ?? 'all_planned';
  const showPlannedRoutes = options?.showPlannedRoutes ?? true;
  const asOf = options?.as_of;
  const { positions, roadGraph, keyNetworkNodes, layoutSiteRects, siteSpecs } = layout;
  const layoutRectsAsInternal = layoutSiteRects as LayoutRect[];

  const visibleQuarries = result.quarries.filter((q) => shouldShowQuarryOnSchematic(q, nodeFilter));
  const visibleConsumers = result.consumers.filter((c) =>
    shouldShowConsumerOnSchematic(c, nodeFilter),
  );

  const quarryById = new Map(visibleQuarries.map((q) => [q.object_id, q]));
  const quarryIds = new Set(visibleQuarries.map((q) => q.object_id));

  const nodes: Node<SandFlowNodeData | SandLegLabelNodeData | SandPlannedLegLabelNodeData>[] = [];
  const edges: Edge[] = [];

  for (const nodeId of keyNetworkNodes) {
    const id = networkNodeId(nodeId);
    const pos = positions.get(id);
    if (!pos) continue;
    nodes.push({
      id,
      type: 'sandNetworkNode',
      position: pos,
      zIndex: 1,
      selectable: false,
      draggable: false,
      className: 'nopan nodrag',
      data: { kind: 'network', label: '', hiddenAnchor: true },
    });
  }

  const segmentFlowM3 = new Map<string, number>();
  const plannedSegmentKeys = new Set<string>();
  const siteLinks = new Set<string>();
  const plannedSiteLinks = new Set<string>();
  const legLabelSpecs: { id: string; flowM3: number; x: number; y: number }[] = [];
  const plannedLegLabelSpecs: { id: string; label: string; x: number; y: number }[] = [];

  let totalDemand = 0;
  let totalAllocated = 0;

  for (const q of visibleQuarries) {
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
        as_of: asOf,
        entry_date: q.entry_date,
        remaining_m3: q.greedy_remaining_m3,
        initial_m3: q.initial_m3,
      },
    });
  }

  for (const c of visibleConsumers) {
    if (!c.snap_node_id) continue;
    if (c.in_service) {
      totalDemand += c.demand_m3;
      totalAllocated += c.greedy_allocated_m3;
    }
    const id = consumerId(c.object_id);
    const planTotal = c.demand_plan_total_m3 ?? c.demand_m3;
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
        as_of: asOf,
        entry_date: c.entry_date,
        demand_m3: c.demand_m3,
        demand_plan_total_m3: planTotal,
        allocated_m3: c.greedy_allocated_m3,
      },
    });

    if (
      c.in_service &&
      c.greedy_quarry_id &&
      quarryIds.has(c.greedy_quarry_id) &&
      c.greedy_allocated_m3 > 0
    ) {
      const quarry = quarryById.get(c.greedy_quarry_id);
      const qSnap = quarry?.snap_node_id;
      const cSnap = c.snap_node_id;
      if (qSnap && cSnap) {
        const path = shortestPath(roadGraph, qSnap, cSnap);
        if (path && path.length >= 1) {
          if (edgeLabelMode === 'key' && c.greedy_allocated_m3 > 0) {
            const polyline = haulLegPolylinePoints(
              path,
              quarryId(c.greedy_quarry_id),
              id,
              positions,
            );
            if (polyline.length >= 2) {
              const mid = polylineMidpoint(polyline);
              legLabelSpecs.push({
                id: `leg-label:${c.greedy_quarry_id}:${c.object_id}`,
                flowM3: c.greedy_allocated_m3,
                x: mid.x,
                y: mid.y,
              });
            }
          }

          siteLinks.add(`${quarryId(c.greedy_quarry_id)}->${networkNodeId(qSnap)}`);
          siteLinks.add(`${networkNodeId(cSnap)}->${id}`);

          if (path.length === 1) {
            siteLinks.add(`${quarryId(c.greedy_quarry_id)}->${id}`);
          } else {
            for (let i = 0; i < path.length - 1; i++) {
              const key = segmentKey(path[i]!, path[i + 1]!);
              segmentFlowM3.set(key, (segmentFlowM3.get(key) ?? 0) + c.greedy_allocated_m3);
            }
          }
        }
      }
    }

    if (
      showPlannedRoutes &&
      !c.in_service &&
      c.nearest_quarry_id &&
      quarryIds.has(c.nearest_quarry_id)
    ) {
      const quarry = quarryById.get(c.nearest_quarry_id);
      const qSnap = quarry?.snap_node_id;
      const cSnap = c.snap_node_id;
      if (!qSnap || !cSnap) continue;

      const path = shortestPath(roadGraph, qSnap, cSnap);
      if (!path || path.length < 1) continue;

      const planM3 = planTotal > 0 ? planTotal : c.demand_m3;
      const entryLabel = c.entry_date?.slice(0, 4) ?? '';
      const labelText =
        planM3 > 0
          ? `план с ${entryLabel} · ${formatSandEdgeM3(planM3)}`
          : `план с ${entryLabel}`;

      if (edgeLabelMode !== 'hidden') {
        const polyline = haulLegPolylinePoints(
          path,
          quarryId(c.nearest_quarry_id),
          id,
          positions,
        );
        if (polyline.length >= 2) {
          const mid = polylineMidpoint(polyline);
          plannedLegLabelSpecs.push({
            id: `planned-leg:${c.nearest_quarry_id}:${c.object_id}`,
            label: labelText,
            x: mid.x,
            y: mid.y,
          });
        }
      }

      plannedSiteLinks.add(`${quarryId(c.nearest_quarry_id)}->${networkNodeId(qSnap)}`);
      plannedSiteLinks.add(`${networkNodeId(cSnap)}->${id}`);

      if (path.length === 1) {
        plannedSiteLinks.add(`${quarryId(c.nearest_quarry_id)}->${id}`);
      } else {
        for (let i = 0; i < path.length - 1; i++) {
          plannedSegmentKeys.add(segmentKey(path[i]!, path[i + 1]!));
        }
      }
    }
  }

  const simplifiedRoadPolylines = simplifyRoadNetworkPolylines(
    roadGraph,
    keyNetworkNodes,
    positions,
  );

  for (const poly of simplifiedRoadPolylines) {
    if (poly.points.length < 2) continue;
    let flowM3 = 0;
    for (const sk of poly.segmentKeys) {
      flowM3 = Math.max(flowM3, segmentFlowM3.get(sk) ?? 0);
    }
    const hasFlow = flowM3 > 0;
    const planned = poly.segmentKeys.some((sk) => plannedSegmentKeys.has(sk));
    const startId = networkNodeId(poly.nodeIds[0]!);
    const endId = networkNodeId(poly.nodeIds[poly.nodeIds.length - 1]!);
    if (startId === endId) continue;
    const first = poly.points[0]!;
    const last = poly.points[poly.points.length - 1]!;
    const labelOffset =
      hasFlow
        ? flowLabelOffset(first.x, first.y, last.x, last.y, flowM3, layoutRectsAsInternal)
        : { labelOffsetX: 0, labelOffsetY: 0 };

    edges.push({
      id: `road-poly-${poly.id}`,
      type: 'sandRoadPolylineEdge',
      source: startId,
      target: endId,
      selectable: false,
      zIndex: hasFlow ? 5 : 0,
      data: {
        points: poly.points,
        flowM3,
        ...labelOffset,
      } satisfies SandRoadPolylineEdgeData,
      style: hasFlow
        ? { stroke: '#b45309', strokeWidth: 4 }
        : { stroke: '#cbd5e1', strokeWidth: 2 },
    });

    if (showPlannedRoutes && planned && !hasFlow) {
      edges.push({
        id: `planned-road-poly-${poly.id}`,
        type: 'sandPlannedRoadPolylineEdge',
        source: startId,
        target: endId,
        selectable: false,
        zIndex: 2,
        data: {
          points: poly.points,
          flowM3: 0,
          planned: true,
        } satisfies SandRoadPolylineEdgeData,
        style: { stroke: '#64748b', strokeWidth: 2, strokeDasharray: '6 4' },
      });
    }
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

  for (const linkKey of plannedSiteLinks) {
    const arrow = linkKey.indexOf('->');
    if (arrow < 0) continue;
    const source = linkKey.slice(0, arrow);
    const target = linkKey.slice(arrow + 2);
    edges.push({
      id: `planned-link-${source}-${target}`,
      type: 'sandPlannedSiteLinkEdge',
      source,
      target,
      zIndex: 3,
      style: { stroke: '#94a3b8', strokeWidth: 1.5, strokeDasharray: '4 3' },
    });
  }

  if (edgeLabelMode === 'key') {
    for (const leg of legLabelSpecs) {
      nodes.push({
        id: leg.id,
        type: 'sandLegLabel',
        position: { x: leg.x, y: leg.y },
        zIndex: 30,
        selectable: false,
        draggable: false,
        data: { kind: 'legLabel', flowM3: leg.flowM3 },
      });
    }
    for (const leg of plannedLegLabelSpecs) {
      nodes.push({
        id: leg.id,
        type: 'sandPlannedLegLabel',
        position: { x: leg.x, y: leg.y },
        zIndex: 25,
        selectable: false,
        draggable: false,
        data: { kind: 'plannedLegLabel', label: leg.label },
      });
    }
  }

  ensureSchematicEndpointNodes(nodes, edges, positions, siteSpecs);

  return {
    nodes,
    edges,
    summary: {
      total_demand_m3: totalDemand,
      total_allocated_m3: totalAllocated,
      unmet_m3: Math.max(0, totalDemand - totalAllocated),
    },
    entryYears: layout.entryYears,
    siteNodeIds: layout.siteNodeIds,
    defaultViewport: layout.defaultViewport,
  };
}

export function sandLogisticsToFlow(
  result: SandLogisticsSubnet,
  options?: SandLogisticsFlowOptions,
): SandLogisticsFlowResult {
  const layout = buildSandLogisticsLayout(result, {
    nodeFilter: options?.nodeFilter,
    groupByEntryYear: options?.groupByEntryYear,
  });
  return buildSandLogisticsSliceFlow(layout, result, options);
}
