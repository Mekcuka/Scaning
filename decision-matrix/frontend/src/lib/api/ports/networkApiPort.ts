import { networkApi } from '../networkApi';

/** Autoroad connect and network planner on the map. */
export type AutoroadNetworkApiPort = Pick<
  typeof networkApi,
  | 'autoroadConnect'
  | 'autoroadNetworkSolverStatus'
  | 'autoroadNetworkBuildRequest'
  | 'autoroadNetworkCompute'
  | 'autoroadNetworkApply'
>;

export const defaultAutoroadNetworkApi: AutoroadNetworkApiPort = networkApi;
