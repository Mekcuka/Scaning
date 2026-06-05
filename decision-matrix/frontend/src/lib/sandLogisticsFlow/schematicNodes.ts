import type { Edge, Node } from '@xyflow/react';
import { NET_SIZE, SITE_H, SITE_W, YEAR_LANE_SPACING } from './constants';
import type { SandFlowNodeData, SandLegLabelNodeData, SandPlannedLegLabelNodeData, SiteSpec } from './types';

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

export function applyEntryYearLaneOffset(
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
