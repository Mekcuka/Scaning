export interface EconomicFlowNodeDto {
  id: string;
  kind: string;
  label: string;
  fluid?: string | null;
  position_x?: number | null;
  position_y?: number | null;
  flow_annual?: number | null;
  flow_unit?: string | null;
  capex_thousand_rub?: number | null;
  opex_thousand_rub_per_year?: number | null;
  revenue_thousand_rub_per_year?: number | null;
  net_thousand_rub_per_year?: number | null;
  formula_label?: string | null;
}

export interface EconomicFlowSummaryDto {
  total_capex_mln: number;
  total_opex_mln_per_year: number;
  total_revenue_mln_per_year: number;
  net_mln_per_year: number;
}

export interface EconomicFlowSchematicDto {
  poi_id: string;
  nodes: EconomicFlowNodeDto[];
  edges: import('./flowSchematic').FlowSchematicEdgeDto[];
  summary: EconomicFlowSummaryDto;
  warnings: string[];
}

export interface EconomicParamsDto {
  project_id: string;
  params: Record<string, number>;
}

export const ECONOMIC_WARNING_LABELS: Record<string, string> = {
  missing_oil_price: 'Не задана цена нефти — выручка по нефтяным узлам не рассчитана.',
  missing_gas_price: 'Не задана цена газа — выручка по газовым узлам не рассчитана.',
  no_bkns_capex_rate: 'Для БКНС нет ставки CAPEX — стоимость принята равной 0.',
  network_not_built: 'Граф инфраструктуры не построен.',
  no_path_for_oil: 'Не найден маршрут нефтепровода.',
  no_path_for_water: 'Не найден маршрут водопровода до БКНС.',
  no_path_for_gas: 'Не найден маршрут газопровода.',
};

export function formatMlnRub(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return `${value.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} млн ₽`;
}

export function thousandToMlnDisplay(thousand: number | null | undefined): string {
  if (thousand == null || Number.isNaN(thousand)) return '—';
  return formatMlnRub(thousand / 1000);
}

export type EconomicNodeData = EconomicFlowNodeDto & Record<string, unknown>;

export function schematicToEconomicFlow(dto: EconomicFlowSchematicDto) {
  const nodes = dto.nodes.map((n) => ({
    id: n.id,
    type: 'economicNode',
    position:
      n.position_x != null && n.position_y != null
        ? { x: n.position_x, y: n.position_y }
        : { x: 0, y: 0 },
    data: { ...n } as EconomicNodeData,
    selectable: true,
  }));
  const edges = dto.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    animated: false,
    style: {
      stroke: '#64748b',
      strokeWidth: 2,
    },
    data: { fluid: e.fluid },
  }));
  return { nodes, edges };
}
