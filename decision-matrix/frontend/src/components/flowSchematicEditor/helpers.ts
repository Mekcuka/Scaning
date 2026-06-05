import type { Node } from '@xyflow/react';
import type { FlowNodeData, FlowSchematicDto } from '../../lib/flowSchematic';
import {
  DEFAULT_SEPARATION_PERCENT,
  nodePersistsThroughputCapacity,
} from '../../lib/flowSchematic';
import type { PoiFlowContext } from '../../lib/flowPropagation';
import type { POI } from '../../lib/api';

export function capacityValuesEqual(
  a: number | null | undefined,
  b: number | null | undefined
): boolean {
  const left = a ?? null;
  const right = b ?? null;
  if (left === null && right === null) return true;
  if (left === null || right === null) return false;
  return Math.abs(left - right) < 1e-9;
}

export function poiFlowContext(poi: POI | null): PoiFlowContext | null {
  if (!poi) return null;
  return {
    fluid_type: poi.fluid_type,
    planned_production_volume: poi.planned_production_volume ?? 0,
    water_injection_volume: poi.water_injection_volume ?? 0,
    gas_factor: poi.gas_factor ?? 120,
  };
}

export function nodesToDto(nodes: Node<FlowNodeData>[]): FlowSchematicDto['nodes'] {
  return nodes.map((n) => {
    const d = n.data;
    return {
      id: n.id,
      kind: d.kind,
      label: d.label,
      fluid: (d.fluid ?? null) as FlowSchematicDto['nodes'][0]['fluid'],
      subtype: d.subtype ?? null,
      status: null,
      position_x: n.position.x,
      position_y: n.position.y,
      throughput_capacity_annual: nodePersistsThroughputCapacity(d.kind)
        ? d.throughput_capacity_annual ?? null
        : null,
      capacity_unit: nodePersistsThroughputCapacity(d.kind) ? d.capacity_unit ?? null : null,
      separation_percent: d.kind === 'separator' ? (d.separation_percent ?? DEFAULT_SEPARATION_PERCENT) : null,
    };
  });
}
