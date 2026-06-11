import type { CapacityUnit, FlowSchematicEdgeDto, FlowSchematicNodeDto, FluidKind } from './flowSchematic';
import {
  liquidFromOilThousandTPerYear,
  producedWaterFromOilThousandTPerYear,
  resolveSeparationShare,
} from './flowSchematic';

const DEFAULT_GAS_FACTOR = 120;
const FLOW_EPS = 1e-6;

export interface PoiFlowContext {
  fluid_type: string;
  planned_production_volume: number;
  water_injection_volume: number;
  gas_factor?: number;
}

function resolveGasFactor(poi: PoiFlowContext): number {
  const gf = poi.gas_factor ?? 0;
  return gf > 0 ? gf : DEFAULT_GAS_FACTOR;
}

export interface NodeFlowState {
  flowAnnual: number | null;
  flowUnit: CapacityUnit | null;
  overCapacity: boolean;
}

/** planned_production_volume на нефтяной POI — дебит нефти (тыс. т/год), не жидкости. */
function branchFlowFromPoi(
  poi: PoiFlowContext,
  fluid: FluidKind,
  separationShare: number | null
): { flow: number | null; unit: CapacityUnit } {
  const production = poi.planned_production_volume || 0;
  const water = poi.water_injection_volume || 0;
  if (fluid === 'oil') {
    if (poi.fluid_type !== 'oil' || production <= 0) return { flow: null, unit: 'thousand_t_per_year' };
    return { flow: Math.round(production * 10) / 10, unit: 'thousand_t_per_year' };
  }
  if (fluid === 'water') {
    if (poi.fluid_type !== 'oil' || production <= 0) return { flow: null, unit: 'thousand_t_per_year' };
    if (separationShare != null) {
      return {
        flow: producedWaterFromOilThousandTPerYear(production, separationShare),
        unit: 'thousand_t_per_year',
      };
    }
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
    const gf = resolveGasFactor(poi);
    return {
      flow: Math.round(((production * gf) / 1000) * 10) / 10,
      unit: 'thousand_m3_per_year',
    };
  }
  return { flow: null, unit: 'thousand_t_per_year' };
}

function poiSourceFlow(
  poi: PoiFlowContext,
  _poiNode: FlowSchematicNodeDto
): { flow: number | null; unit: CapacityUnit } {
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
  fallbackUnit: CapacityUnit,
  separationShare: number
): { flow: number; unit: CapacityUnit } {
  if (edgeFluid === 'oil' || edgeFluid === 'water' || edgeFluid === 'gas') {
    const bf = branchFlowFromPoi(poi, edgeFluid as FluidKind, separationShare);
    if (bf.flow != null) return { flow: bf.flow, unit: bf.unit };
    if (edgeFluid === 'water') return { flow: 0, unit: 'thousand_t_per_year' };
  }
  return { flow: fallbackFlow, unit: fallbackUnit };
}

export interface EdgeFlowState {
  flowAnnual: number | null;
  flowUnit: CapacityUnit | null;
}

export interface FlowPropagationResult {
  nodes: Map<string, NodeFlowState>;
  edges: Map<string, EdgeFlowState>;
}

function emptyEdgeFlows(edges: FlowSchematicEdgeDto[]): Map<string, EdgeFlowState> {
  return new Map(edges.map((e) => [e.id, { flowAnnual: null, flowUnit: null }]));
}

export function propagateFlows(
  nodes: FlowSchematicNodeDto[],
  edges: FlowSchematicEdgeDto[],
  poi: PoiFlowContext
): FlowPropagationResult {
  const result = new Map<string, NodeFlowState>();
  const edgeResult = emptyEdgeFlows(edges);
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const outAdj = new Map<string, { edgeId: string; target: string; fluid?: string }[]>();
  for (const n of nodes) outAdj.set(n.id, []);
  for (const e of edges) {
    const list = outAdj.get(e.source);
    if (list) list.push({ edgeId: e.id, target: e.target, fluid: e.fluid });
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
    const curAt = flowAt.get(curId);
    if (!curAt) continue;
    const { flow: curFlow, unit: curUnit } = curAt;
    const curNode = nodeById.get(curId);
    const curKind = curNode?.kind ?? '';

    for (const { edgeId, target: tgtId, fluid: edgeFluid } of outAdj.get(curId) ?? []) {
      if (!nodeById.has(tgtId)) continue;
      const tgtNode = nodeById.get(tgtId);
      let nextFlow: number;
      let nextUnit: CapacityUnit;
      if (curKind === 'poi' && tgtNode?.kind === 'separator' && poi.fluid_type === 'oil') {
        const share = resolveSeparationShare(tgtNode.separation_percent);
        const liquid = liquidFromOilThousandTPerYear(curFlow, share);
        nextFlow = liquid ?? curFlow;
        nextUnit = curUnit;
      } else if (curKind === 'separator') {
        const share = resolveSeparationShare(curNode?.separation_percent);
        const n = flowAfterSeparator(poi, edgeFluid, curFlow, curUnit, share);
        nextFlow = n.flow;
        nextUnit = n.unit;
      } else {
        nextFlow = curFlow;
        nextUnit = curUnit;
      }

      edgeResult.set(edgeId, { flowAnnual: nextFlow, flowUnit: nextUnit });

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
  return { nodes: result, edges: edgeResult };
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
