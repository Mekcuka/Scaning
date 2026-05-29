import type { CapacityUnit, FlowSchematicEdgeDto, FlowSchematicNodeDto, FluidKind } from './flowSchematic';
import { resolveCapacityUnit } from './flowSchematic';

const OIL_PHASE_SHARE = 0.85;
const GAS_M3_PER_TON_OIL = 120;
const FLOW_EPS = 1e-6;

export interface PoiFlowContext {
  fluid_type: string;
  planned_production_volume: number;
  water_injection_volume: number;
}

export interface NodeFlowState {
  flowAnnual: number | null;
  flowUnit: CapacityUnit | null;
  overCapacity: boolean;
}

function branchFlowFromPoi(
  poi: PoiFlowContext,
  fluid: FluidKind
): { flow: number | null; unit: CapacityUnit } {
  const production = poi.planned_production_volume || 0;
  const water = poi.water_injection_volume || 0;
  if (fluid === 'oil') {
    if (poi.fluid_type !== 'oil' || production <= 0) return { flow: null, unit: 'thousand_t_per_year' };
    return { flow: Math.round(production * OIL_PHASE_SHARE * 10) / 10, unit: 'thousand_t_per_year' };
  }
  if (fluid === 'water') {
    if (water <= 0) return { flow: null, unit: 'thousand_t_per_year' };
    return { flow: water, unit: 'thousand_t_per_year' };
  }
  if (fluid === 'gas') {
    if (poi.fluid_type === 'gas') {
      return {
        flow: production > 0 ? production : null,
        unit: 'thousand_m3_per_year',
      };
    }
    if (production <= 0) return { flow: null, unit: 'thousand_m3_per_year' };
    return {
      flow: Math.round(((production * OIL_PHASE_SHARE * GAS_M3_PER_TON_OIL) / 1000) * 10) / 10,
      unit: 'thousand_m3_per_year',
    };
  }
  return { flow: null, unit: 'thousand_t_per_year' };
}

function poiSourceFlow(
  poi: PoiFlowContext,
  poiNode: FlowSchematicNodeDto
): { flow: number | null; unit: CapacityUnit } {
  if (poiNode.throughput_capacity_annual != null) {
    return {
      flow: poiNode.throughput_capacity_annual,
      unit: resolveCapacityUnit(poiNode),
    };
  }
  const production = poi.planned_production_volume || 0;
  if (poi.fluid_type === 'gas') {
    return { flow: production > 0 ? production : null, unit: 'thousand_m3_per_year' };
  }
  return { flow: production > 0 ? production : null, unit: 'thousand_t_per_year' };
}

function flowAfterSeparator(
  poi: PoiFlowContext,
  edgeFluid: string | undefined,
  fallbackFlow: number,
  fallbackUnit: CapacityUnit
): { flow: number; unit: CapacityUnit } {
  if (edgeFluid === 'oil' || edgeFluid === 'water' || edgeFluid === 'gas') {
    const bf = branchFlowFromPoi(poi, edgeFluid);
    if (bf.flow != null) return { flow: bf.flow, unit: bf.unit };
  }
  return { flow: fallbackFlow, unit: fallbackUnit };
}

export function propagateFlows(
  nodes: FlowSchematicNodeDto[],
  edges: FlowSchematicEdgeDto[],
  poi: PoiFlowContext
): Map<string, NodeFlowState> {
  const result = new Map<string, NodeFlowState>();
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const outAdj = new Map<string, { target: string; fluid?: string }[]>();
  for (const n of nodes) outAdj.set(n.id, []);
  for (const e of edges) {
    const list = outAdj.get(e.source);
    if (list) list.push({ target: e.target, fluid: e.fluid });
  }

  const poiNodes = nodes.filter((n) => n.kind === 'poi');
  const flowAt = new Map<string, { flow: number; unit: CapacityUnit }>();
  const queue: string[] = [];

  for (const pn of poiNodes) {
    const { flow, unit } = poiSourceFlow(poi, pn);
    if (flow == null) continue;
    flowAt.set(pn.id, { flow, unit });
    queue.push(pn.id);
  }

  let head = 0;
  while (head < queue.length) {
    const curId = queue[head++];
    const { flow: curFlow, unit: curUnit } = flowAt.get(curId)!;
    const curNode = nodeById.get(curId);
    const curKind = curNode?.kind ?? '';

    for (const { target: tgtId, fluid: edgeFluid } of outAdj.get(curId) ?? []) {
      if (!nodeById.has(tgtId)) continue;
      let nextFlow: number;
      let nextUnit: CapacityUnit;
      if (curKind === 'separator') {
        const n = flowAfterSeparator(poi, edgeFluid, curFlow, curUnit);
        nextFlow = n.flow;
        nextUnit = n.unit;
      } else {
        nextFlow = curFlow;
        nextUnit = curUnit;
      }

      const prev = flowAt.get(tgtId);
      if (!prev) {
        flowAt.set(tgtId, { flow: nextFlow, unit: nextUnit });
        queue.push(tgtId);
      } else if (prev.unit === nextUnit && nextFlow > prev.flow) {
        flowAt.set(tgtId, { flow: nextFlow, unit: nextUnit });
      }
    }
  }

  for (const n of nodes) {
    const at = flowAt.get(n.id);
    if (!at) {
      result.set(n.id, { flowAnnual: null, flowUnit: null, overCapacity: false });
      continue;
    }
    const cap = n.throughput_capacity_annual;
    const capUnit = n.capacity_unit ?? at.unit;
    const over =
      n.kind !== 'fluid_branch' &&
      cap != null &&
      capUnit === at.unit &&
      at.flow > cap + FLOW_EPS;
    result.set(n.id, {
      flowAnnual: at.flow,
      flowUnit: at.unit,
      overCapacity: over,
    });
  }
  return result;
}

export function applyFlowStateToNodes<T extends { id: string; data: FlowNodeDataLike }>(
  nodes: T[],
  flowMap: Map<string, NodeFlowState>
): T[] {
  return nodes.map((n) => {
    const fs = flowMap.get(n.id);
    return {
      ...n,
      data: {
        ...n.data,
        flow_annual: fs?.flowAnnual ?? null,
        flow_unit: fs?.flowUnit ?? null,
        over_capacity: fs?.overCapacity ?? false,
      },
    };
  });
}

type FlowNodeDataLike = {
  flow_annual?: number | null;
  flow_unit?: CapacityUnit | null;
  over_capacity?: boolean;
  throughput_capacity_annual?: number | null;
  capacity_unit?: string | null;
  [key: string]: unknown;
};
