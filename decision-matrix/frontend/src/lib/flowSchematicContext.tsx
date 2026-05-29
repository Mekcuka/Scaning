import { createContext, useContext } from 'react';
import type { NodeFlowState, PoiFlowContext } from './flowPropagation';

export type FlowSchematicActions = {
  onCapacityChange: (nodeId: string, value: number | null, unit: string) => void;
};

export const FlowPropagationContext = createContext<Map<string, NodeFlowState>>(new Map());

export const FlowSchematicActionsContext = createContext<FlowSchematicActions | null>(null);

export const FlowPoiContext = createContext<(PoiFlowContext & { eng_injection?: string }) | null>(
  null
);

export function useFlowPropagation() {
  return useContext(FlowPropagationContext);
}

export function useFlowSchematicActions() {
  return useContext(FlowSchematicActionsContext);
}

export function useFlowPoi() {
  return useContext(FlowPoiContext);
}
