import type { SandLogisticsSubnet } from '../api';
import { buildSandLogisticsLayout } from './layout';
import { buildSandLogisticsSliceFlow } from './sliceFlow';
import type { SandLogisticsFlowOptions, SandLogisticsFlowResult } from './types';

export function sandLogisticsToFlow(
  result: SandLogisticsSubnet,
  options?: SandLogisticsFlowOptions,
): SandLogisticsFlowResult {
  const layout = buildSandLogisticsLayout(result, {
    nodeFilter: options?.nodeFilter,
    groupByEntryYear: options?.groupByEntryYear,
  });
  return buildSandLogisticsSliceFlow(layout, result, options);
}
