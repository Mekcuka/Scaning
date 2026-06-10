import { flowApi } from '../flowApi';

/** Flow schematic read/write for technology and economic views. */
export type FlowSchematicApiPort = Pick<
  typeof flowApi,
  'getFlowSchematic' | 'getEconomicFlowSchematic' | 'saveFlowSchematic' | 'resetFlowSchematic'
>;

export const defaultFlowSchematicApi: FlowSchematicApiPort = flowApi;
