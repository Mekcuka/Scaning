import type { Node } from '@xyflow/react';
import { expect } from 'vitest';
import type { SandLogisticsFlowResult } from '../../lib/sandLogisticsFlow';

/** Каждое ребро React Flow должно иметь существующий source/target — иначе падение схемы. */
export function expectAllEdgeEndpointsHaveNodes(
  flow: Pick<SandLogisticsFlowResult, 'nodes' | 'edges'>,
): void {
  const nodeIds = new Set(flow.nodes.map((n) => n.id));
  for (const edge of flow.edges) {
    expect(nodeIds.has(String(edge.source)), `missing source node ${edge.source}`).toBe(true);
    expect(nodeIds.has(String(edge.target)), `missing target node ${edge.target}`).toBe(true);
  }
}

/** Упрощённая сеть: только полилинии, без покомponentных sandRoadEdge. */
export function expectSimplifiedRoadPolylinesOnly(flow: Pick<SandLogisticsFlowResult, 'edges'>): void {
  const roadTypes = flow.edges.map((e) => e.type);
  expect(roadTypes).not.toContain('sandRoadEdge');
  expect(roadTypes.some((t) => t === 'sandRoadPolylineEdge' || t === 'sandPlannedRoadPolylineEdge')).toBe(
    true,
  );
}

export function expectPolylineEdgesValid(flow: Pick<SandLogisticsFlowResult, 'edges'>): void {
  for (const edge of flow.edges) {
    if (edge.type !== 'sandRoadPolylineEdge' && edge.type !== 'sandPlannedRoadPolylineEdge') continue;
    const points = (edge.data as { points?: { x: number; y: number }[] })?.points;
    expect(points?.length ?? 0, `polyline ${edge.id} must have >= 2 points`).toBeGreaterThanOrEqual(2);
  }
}

export function expectNoSelfLoopEdges(flow: Pick<SandLogisticsFlowResult, 'edges'>): void {
  for (const edge of flow.edges) {
    expect(edge.source, `self-loop on ${edge.id}`).not.toBe(edge.target);
  }
}

export function expectHiddenNetworkAnchors(
  nodes: Node[],
  options?: { minCount?: number },
): void {
  const anchors = nodes.filter((n) => n.type === 'sandNetworkNode');
  if (options?.minCount != null) {
    expect(anchors.length).toBeGreaterThanOrEqual(options.minCount);
  }
  for (const anchor of anchors) {
    expect(anchor.data).toMatchObject({ kind: 'network', hiddenAnchor: true });
  }
}
