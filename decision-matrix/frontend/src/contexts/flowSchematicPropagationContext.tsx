import { createContext, useContext } from 'react';
import type { EdgeFlowState, NodeFlowState, PoiFlowContext } from '../lib/flowPropagation';

export type FlowSchematicActions = {
  onCapacityChange: (nodeId: string, value: number | null, unit: string) => void;
  onSeparationPercentChange: (nodeId: string, value: number) => void;
  onPoiProductionChange: (volume: number) => void;
};

export const FlowPropagationContext = createContext<Map<string, NodeFlowState>>(new Map());

export const FlowEdgePropagationContext = createContext<Map<string, EdgeFlowState>>(new Map());

export const FlowSchematicActionsContext = createContext<FlowSchematicActions | null>(null);

export const FlowPoiContext = createContext<(PoiFlowContext & { eng_injection?: string }) | null>(
  null
);

export function useFlowPropagation() {
  return useContext(FlowPropagationContext);
}

export function useFlowEdgePropagation() {
  return useContext(FlowEdgePropagationContext);
}

export function useFlowSchematicActions() {
  return useContext(FlowSchematicActionsContext);
}

export function useFlowPoi() {
  return useContext(FlowPoiContext);
}
