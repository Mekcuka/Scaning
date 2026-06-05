import type { Node } from '@xyflow/react';
import type { SandLogisticsSubnet } from '../api';
import type {
  SandFlowNodeData,
  SandLegLabelNodeData,
  SandPlannedLegLabelNodeData,
  SandLogisticsNodeFilterMode,
} from './types';
import type { SandLogisticsConsumerRow, SandLogisticsQuarryRow } from '../api';

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
