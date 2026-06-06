import { ViewportPortal } from '@xyflow/react';
import { formatSandEdgeFlow, formatSandEdgeM3Full } from '../../../lib/sandLogisticsFlow';

export function SandFlowEdgeVolumeLabel({
  lx,
  ly,
  flowM3,
  stroke,
}: {
  lx: number;
  ly: number;
  flowM3: number;
  stroke: string;
}) {
  return (
    <ViewportPortal>
      <div
        className="flow-edge-label sand-flow-road-volume-label nodrag nopan"
        style={{
          position: 'absolute',
          transform: `translate(-50%, -50%) translate(${lx}px, ${ly}px)`,
          borderColor: stroke,
          color: stroke,
        }}
        title={formatSandEdgeM3Full(flowM3)}
      >
        {formatSandEdgeFlow(flowM3)}
      </div>
    </ViewportPortal>
  );
}
