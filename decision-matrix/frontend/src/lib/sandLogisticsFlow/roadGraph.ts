import type { SandLogisticsSubnet } from '../api';
import { NET_SIZE } from './constants';
import { networkCenter } from './geometry';
import { networkNodeId, segmentKey } from './ids';
import type { RoadGraph, RoadSegment, SiteSpec } from './types';

export function buildRoadGraph(subnet: SandLogisticsSubnet): RoadGraph {
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

export function shortestPath(adj: RoadGraph, start: string, end: string): string[] | null {
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

export { networkCenter };
