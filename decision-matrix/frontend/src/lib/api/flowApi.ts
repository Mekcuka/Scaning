import { request } from './client';
import type { EconomicFlowSchematicDto } from '../economicFlowSchematic';
import type {
  FlowSchematicDto,
  FlowSchematicEdgeDto,
  FlowSchematicNodeDto,
} from '../flowSchematic';

export const flowApi = {
  getFlowSchematic: (projectId: string, poiId: string) =>
    request<FlowSchematicDto>(`/projects/${projectId}/pois/${poiId}/flow-schematic`),
  saveFlowSchematic: (
    projectId: string,
    poiId: string,
    body: { nodes: FlowSchematicNodeDto[]; edges: FlowSchematicEdgeDto[] },
  ) =>
    request<FlowSchematicDto>(`/projects/${projectId}/pois/${poiId}/flow-schematic`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  resetFlowSchematic: (projectId: string, poiId: string) =>
    request<FlowSchematicDto>(`/projects/${projectId}/pois/${poiId}/flow-schematic`, {
      method: 'DELETE',
    }),
  getEconomicFlowSchematic: (projectId: string, poiId: string) =>
    request<EconomicFlowSchematicDto>(`/projects/${projectId}/pois/${poiId}/economic-flow-schematic`),
};
