import { sandLogisticsApi } from '../sandLogisticsApi';

/** Read persisted sand logistics result. */
export type SandLogisticsReadApiPort = Pick<typeof sandLogisticsApi, 'getSandLogisticsResult'>;

/** Trigger sand logistics analysis. */
export type SandLogisticsWriteApiPort = Pick<typeof sandLogisticsApi, 'analyzeSandLogistics'>;

export type SandLogisticsApiPort = SandLogisticsReadApiPort & SandLogisticsWriteApiPort;

export const defaultSandLogisticsReadApi: SandLogisticsReadApiPort = sandLogisticsApi;
export const defaultSandLogisticsApi: SandLogisticsApiPort = sandLogisticsApi;
