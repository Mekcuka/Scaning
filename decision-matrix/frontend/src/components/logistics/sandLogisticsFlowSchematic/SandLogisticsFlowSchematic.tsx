import { ReactFlowProvider } from '@xyflow/react';
import type { SandLogisticsSubnet } from '../../../lib/api';
import { SandLogisticsFlowSchematicInner } from './SandLogisticsFlowSchematicInner';

export function SandLogisticsFlowSchematic({
  subnet,
  layoutSubnet,
  sliceSubnet,
  asOf,
  horizonFrom,
  horizonTo,
  viewAsOf,
  onViewAsOfChange,
}: {
  subnet?: SandLogisticsSubnet;
  layoutSubnet?: SandLogisticsSubnet;
  sliceSubnet?: SandLogisticsSubnet;
  asOf?: string;
  horizonFrom?: string;
  horizonTo?: string;
  viewAsOf?: string;
  onViewAsOfChange?: (next: string) => void;
}) {
  const resolvedLayout = layoutSubnet ?? subnet;
  const resolvedSlice = sliceSubnet ?? subnet;
  if (!resolvedLayout || !resolvedSlice) return null;

  return (
    <ReactFlowProvider>
      <SandLogisticsFlowSchematicInner
        layoutSubnet={resolvedLayout}
        sliceSubnet={resolvedSlice}
        asOf={asOf}
        horizonFrom={horizonFrom}
        horizonTo={horizonTo}
        viewAsOf={viewAsOf}
        onViewAsOfChange={onViewAsOfChange}
      />
    </ReactFlowProvider>
  );
}
