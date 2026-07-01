import type { InfraObject } from '../../lib/api';

export type PadEarthworkDetailBridge = {
  isParamsDirty: boolean;
  saveParamsIfDirty: () => Promise<InfraObject | undefined>;
};