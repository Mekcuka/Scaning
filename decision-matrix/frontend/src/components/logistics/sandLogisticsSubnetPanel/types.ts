import type { SandLogisticsResult, SandLogisticsSubnet } from '../../../lib/api';

export type SandLogisticsSubnetPanelProps = {
  canonicalSubnet?: SandLogisticsSubnet;
  sliceSubnet?: SandLogisticsSubnet;
  /** @deprecated use sliceSubnet */
  subnet?: SandLogisticsSubnet;
  result: SandLogisticsResult;
  viewAsOf?: string;
  onViewAsOfChange?: (next: string) => void;
};
