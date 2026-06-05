import { SITE_H, SITE_W } from './constants';
import { siteCenter } from './geometry';
import { networkCenter } from './roadGraph';
import { networkNodeId, segmentKey } from './ids';
import type { RoadGraph, SimplifiedRoadPolyline } from './types';

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
