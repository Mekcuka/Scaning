import { createContext, useContext, type ReactNode } from 'react';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import type { POI } from '../../lib/api';
import type { FlowSchematicDto } from '../../lib/flowSchematic';
import type { EconomicFlowSchematicDto } from '../../lib/economicFlowSchematic';

export type FlowSchematicContextValue = {
  projectId: string | null;
  pois: POI[];
  poisLoading: boolean;
  activePoiId: string;
  setSelectedPoiId: (id: string) => void;
  schematicQuery: UseQueryResult<FlowSchematicDto, Error>;
  economicQuery: UseQueryResult<EconomicFlowSchematicDto, Error>;
  schematicEditorKey: string;
  needsNetwork: boolean;
  saveMut: UseMutationResult<FlowSchematicDto, Error, FlowSchematicDto, unknown>;
  persistSchematicMut: UseMutationResult<FlowSchematicDto, Error, FlowSchematicDto, unknown>;
  poiProductionMut: UseMutationResult<POI, Error, number, unknown>;
  resetMut: UseMutationResult<FlowSchematicDto, Error, void, unknown>;
};

const FlowSchematicContext = createContext<FlowSchematicContextValue | null>(null);

export function FlowSchematicProvider({
  value,
  children,
}: {
  value: FlowSchematicContextValue;
  children: ReactNode;
}) {
  return <FlowSchematicContext.Provider value={value}>{children}</FlowSchematicContext.Provider>;
}

export function useFlowSchematicContext(): FlowSchematicContextValue {
  const ctx = useContext(FlowSchematicContext);
  if (!ctx) {
    throw new Error('useFlowSchematicContext must be used within FlowSchematicLayout');
  }
  return ctx;
}
