import dagre from 'dagre';
import type { Edge, Node } from '@xyflow/react';

export type FluidKind = 'oil' | 'water' | 'gas';

export type CapacityUnit = 'thousand_t_per_year' | 'thousand_m3_per_year';

export interface FlowSchematicNodeDto {
  id: string;
  kind: string;
  label: string;
  fluid: FluidKind | null;
  subtype: string | null;
  status: string | null;
  position_x?: number | null;
  position_y?: number | null;
  throughput_capacity_annual?: number | null;
  capacity_unit?: CapacityUnit | string | null;
  flow_annual?: number | null;
  flow_unit?: CapacityUnit | string | null;
  over_capacity?: boolean;
}

export interface FlowSchematicEdgeDto {
  id: string;
  source: string;
  target: string;
  fluid: string;
}

export interface FlowSchematicDto {
  poi_id: string;
  nodes: FlowSchematicNodeDto[];
  edges: FlowSchematicEdgeDto[];
  warnings: string[];
  source?: 'auto' | 'custom';
}

export type FlowEditorTool = 'select' | 'connect' | 'add';

export const FLUID_COLORS: Record<string, string> = {
  oil: '#2d5016',
  water: '#1565c0',
  gas: '#e65100',
};

export const FLUID_LABELS: Record<string, string> = {
  oil: 'Нефть',
  water: 'Вода',
  gas: 'Газ',
};

export const WARNING_LABELS: Record<string, string> = {
  network_not_built: 'Граф инфраструктуры не построен. На карте нажмите «Сеть» после импорта линий.',
  no_path_for_oil: 'Не найден маршрут нефтепровода до приёмного объекта.',
  no_path_for_water: 'Не найден маршрут водопровода до объекта закачки.',
  no_path_for_gas: 'Не найден маршрут газопровода до ГКС или ГТЭС.',
};

export const ADD_NODE_TEMPLATES: {
  kind: string;
  label: string;
  fluid: FluidKind | null;
}[] = [
  { kind: 'custom', label: 'Блок', fluid: null },
  { kind: 'separator', label: 'Сепарация', fluid: null },
  { kind: 'fluid_branch', label: 'Нефть', fluid: 'oil' },
  { kind: 'fluid_branch', label: 'Вода', fluid: 'water' },
  { kind: 'fluid_branch', label: 'Газ', fluid: 'gas' },
  { kind: 'process', label: 'Процесс', fluid: 'oil' },
  { kind: 'network_segment', label: 'Трубопровод', fluid: 'oil' },
  { kind: 'terminal', label: 'Приёмный объект', fluid: 'oil' },
  { kind: 'utilization', label: 'Утилизация', fluid: 'gas' },
];

const NODE_WIDTH = 200;
const NODE_HEIGHT = 52;

const KIND_STYLES: Record<string, { bg: string; border: string }> = {
  poi: { bg: '#f1f5f9', border: '#64748b' },
  separator: { bg: '#e2e8f0', border: '#475569' },
  fluid_branch: { bg: '#fff', border: '#94a3b8' },
  process: { bg: '#fef9c3', border: '#ca8a04' },
  network_segment: { bg: '#ecfdf5', border: '#059669' },
  terminal: { bg: '#ede9fe', border: '#7c3aed' },
  utilization: { bg: '#fff7ed', border: '#ea580c' },
  custom: { bg: '#fafafa', border: '#a3a3a3' },
};

export function kindStyle(kind: string, fluid: string | null | undefined) {
  if (kind === 'fluid_branch' && fluid && FLUID_COLORS[fluid]) {
    return { bg: '#fff', border: FLUID_COLORS[fluid] };
  }
  return KIND_STYLES[kind] ?? { bg: '#fff', border: '#cbd5e1' };
}

/** Ветки Нефть / Вода / Газ — только поток, без пропускной способности. */
export function nodeHasThroughputCapacity(kind: string): boolean {
  return kind !== 'fluid_branch';
}

export function resolveCapacityUnit(data: {
  fluid?: FluidKind | null;
  capacity_unit?: CapacityUnit | string | null;
}): CapacityUnit {
  if (data.fluid === 'gas' || data.capacity_unit === 'thousand_m3_per_year') {
    return 'thousand_m3_per_year';
  }
  return 'thousand_t_per_year';
}

export function capacityUnitLabel(unit: CapacityUnit | string | null | undefined): string {
  return unit === 'thousand_m3_per_year' ? 'тыс. м³/год' : 'тыс. т/год';
}

export function parseCapacityInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed.replace(',', '.'));
  if (Number.isNaN(n) || n < 0) return null;
  return n;
}

export function formatCapacity(
  value: number | null | undefined,
  unit: string | null | undefined
): string {
  if (value == null || Number.isNaN(value)) {
    return 'не задана';
  }
  const formatted = value.toLocaleString('ru-RU', { maximumFractionDigits: 1 });
  if (unit === 'thousand_m3_per_year') {
    return `${formatted} тыс. м³/год`;
  }
  return `${formatted} тыс. т/год`;
}

export function hasSavedPositions(dto: FlowSchematicDto): boolean {
  return dto.nodes.some((n) => n.position_x != null && n.position_y != null);
}

export function schematicToFlow(dto: FlowSchematicDto): { nodes: Node[]; edges: Edge[] } {
  const rfNodes: Node[] = dto.nodes.map((n) => ({
    id: n.id,
    type: 'flowNode',
    data: {
      label: n.label,
      kind: n.kind,
      fluid: n.fluid,
      throughput_capacity_annual: n.throughput_capacity_annual ?? null,
      capacity_unit: n.capacity_unit ?? null,
      flow_annual: n.flow_annual ?? null,
      flow_unit: (n.flow_unit as CapacityUnit | null) ?? null,
      over_capacity: n.over_capacity ?? false,
    },
    position:
      n.position_x != null && n.position_y != null
        ? { x: n.position_x, y: n.position_y }
        : { x: 0, y: 0 },
    selected: false,
  }));

  const rfEdges: Edge[] = dto.edges.map((e) => edgeFromDto(e));

  const nodes =
    hasSavedPositions(dto) || dto.source === 'custom'
      ? rfNodes
      : layoutWithDagre(rfNodes, rfEdges);

  return { nodes, edges: rfEdges };
}

export function edgeFromDto(e: FlowSchematicEdgeDto): Edge {
  return {
    id: e.id,
    source: e.source,
    target: e.target,
    animated: true,
    style: {
      stroke: FLUID_COLORS[e.fluid] ?? '#64748b',
      strokeWidth: 2,
    },
    data: { fluid: e.fluid },
  };
}

export function flowToSchematicDto(
  poiId: string,
  nodes: Node[],
  edges: Edge[],
  warnings: string[]
): FlowSchematicDto {
  return {
    poi_id: poiId,
    warnings,
    source: 'custom',
    nodes: nodes.map((n) => {
      const d = n.data as FlowNodeData;
      return {
        id: n.id,
        kind: d.kind,
        label: d.label,
        fluid: (d.fluid ?? null) as FluidKind | null,
        subtype: d.subtype ?? null,
        status: null,
        position_x: n.position.x,
        position_y: n.position.y,
        throughput_capacity_annual: nodeHasThroughputCapacity(d.kind)
          ? d.throughput_capacity_annual ?? null
          : null,
        capacity_unit: nodeHasThroughputCapacity(d.kind) ? d.capacity_unit ?? null : null,
      };
    }),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      fluid: ((e.data as { fluid?: string })?.fluid ?? 'oil') as string,
    })),
  };
}

export function toReactFlowGraph(dto: FlowSchematicDto): { nodes: Node[]; edges: Edge[] } {
  return schematicToFlow(dto);
}

export function layoutWithDagre(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', nodesep: 48, ranksep: 72, marginx: 24, marginy: 24 });

  nodes.forEach((node) => {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });
  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });
  dagre.layout(g);

  return nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - NODE_HEIGHT / 2,
      },
    };
  });
}

export type FlowNodeData = {
  label: string;
  kind: string;
  fluid?: FluidKind | null;
  subtype?: string | null;
  throughput_capacity_annual?: number | null;
  capacity_unit?: CapacityUnit | string | null;
  flow_annual?: number | null;
  flow_unit?: CapacityUnit | string | null;
  over_capacity?: boolean;
};

export function newNodeId(): string {
  return `custom-${crypto.randomUUID()}`;
}

export function newEdgeId(): string {
  return `edge-${crypto.randomUUID()}`;
}
