import { describe, expect, it } from 'vitest';
import { propagateFlows, type PoiFlowContext } from './flowPropagation';
import type { FlowSchematicEdgeDto, FlowSchematicNodeDto } from './flowSchematic';

const oilPoi: PoiFlowContext = {
  fluid_type: 'oil',
  planned_production_volume: 500,
  water_injection_volume: 0,
  gas_factor: 120,
};

const miniChain = (): { nodes: FlowSchematicNodeDto[]; edges: FlowSchematicEdgeDto[] } => ({
  nodes: [
    { id: 'poi-1', kind: 'poi', label: 'Куст' },
    { id: 'sep-1', kind: 'separator', label: 'Сепарация', separation_percent: 85 },
    { id: 'branch-oil', kind: 'fluid_branch', label: 'Нефть', fluid: 'oil' },
    { id: 'branch-gas', kind: 'fluid_branch', label: 'Газ', fluid: 'gas' },
  ],
  edges: [
    { id: 'e1', source: 'poi-1', target: 'sep-1', fluid: 'oil' },
    { id: 'e2', source: 'sep-1', target: 'branch-oil', fluid: 'oil' },
    { id: 'e3', source: 'sep-1', target: 'branch-gas', fluid: 'gas' },
  ],
});

describe('propagateFlows', () => {
  it('uses planned production as oil rate on oil branch', () => {
    const { nodes, edges } = miniChain();
    const { nodes: flowMap } = propagateFlows(nodes, edges, oilPoi);
    expect(flowMap.get('poi-1')?.flowAnnual).toBe(500);
    expect(flowMap.get('branch-oil')?.flowAnnual).toBe(500);
  });

  it('computes associated gas from oil debit and gas factor', () => {
    const { nodes, edges } = miniChain();
    const { nodes: flowMap } = propagateFlows(nodes, edges, oilPoi);
    expect(flowMap.get('branch-gas')?.flowAnnual).toBe(60);
    expect(flowMap.get('branch-gas')?.flowUnit).toBe('thousand_m3_per_year');
  });

  it('does not reduce oil branch when separation percent changes', () => {
    const { nodes, edges } = miniChain();
    nodes[1] = { ...nodes[1]!, separation_percent: 70 };
    const { nodes: flowMap } = propagateFlows(nodes, edges, oilPoi);
    expect(flowMap.get('branch-oil')?.flowAnnual).toBe(500);
  });

  it('computes produced water at separator from oil debit and separation share', () => {
    const nodes: FlowSchematicNodeDto[] = [
      { id: 'poi-1', kind: 'poi', label: 'Куст' },
      { id: 'sep-1', kind: 'separator', label: 'Сепарация', separation_percent: 85 },
      { id: 'branch-oil', kind: 'fluid_branch', label: 'Нефть', fluid: 'oil' },
      { id: 'branch-water', kind: 'fluid_branch', label: 'Вода', fluid: 'water' },
    ];
    const edges: FlowSchematicEdgeDto[] = [
      { id: 'e1', source: 'poi-1', target: 'sep-1', fluid: 'oil' },
      { id: 'e2', source: 'sep-1', target: 'branch-oil', fluid: 'oil' },
      { id: 'e3', source: 'sep-1', target: 'branch-water', fluid: 'water' },
    ];
    const { nodes: flowMap } = propagateFlows(nodes, edges, oilPoi);
    expect(flowMap.get('branch-oil')?.flowAnnual).toBe(500);
    expect(flowMap.get('branch-water')?.flowAnnual).toBeCloseTo(88.2, 1);
    expect(flowMap.get('sep-1')?.flowAnnual).toBeCloseTo(588.2, 1);
  });
});
