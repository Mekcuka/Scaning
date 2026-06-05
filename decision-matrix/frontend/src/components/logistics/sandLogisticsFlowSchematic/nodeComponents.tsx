import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import {
  formatSandEdgeM3,
  SAND_FLOW_NET_SIZE,
  type SandFlowNodeData,
  type SandLegLabelNodeData,
  type SandPlannedLegLabelNodeData,
} from '../../../lib/sandLogisticsFlow';
import {
  consumerVolumeLines,
  entryDateLine,
  nodeChromeForStatus,
  nodeTooltipTitle,
  quarryVolumeLines,
  resolveSandConsumerNodeStatus,
  resolveSandNodeStatus,
  resolveSandQuarryNodeStatus,
} from '../../../lib/sandLogisticsNodeVisual';

const SandNetworkNode = memo(function SandNetworkNode() {
  return (
    <div
      className="nopan nodrag"
      aria-hidden="true"
      style={{
        width: SAND_FLOW_NET_SIZE,
        height: SAND_FLOW_NET_SIZE,
        opacity: 0,
        pointerEvents: 'none',
      }}
    >
      <Handle type="target" position={Position.Left} className="!opacity-0 !w-px !h-px" />
      <Handle type="source" position={Position.Right} className="!opacity-0 !w-px !h-px" />
    </div>
  );
});

const SandFlowNode = memo(function SandFlowNode({ data, selected }: NodeProps<Node<SandFlowNodeData>>) {
  const status = resolveSandNodeStatus(data);
  const chrome = nodeChromeForStatus(status, data.kind, data);
  const entryLine = entryDateLine(data);
  const volumeLines =
    data.kind === 'consumer'
      ? consumerVolumeLines(resolveSandConsumerNodeStatus(data), data)
      : data.kind === 'quarry'
        ? quarryVolumeLines(resolveSandQuarryNodeStatus(data), data)
        : [];

  const coordTitle =
    data.lon != null && data.lat != null
      ? `${data.lat.toFixed(6)}, ${data.lon.toFixed(6)}`
      : undefined;

  return (
    <div
      className="flow-schematic-node px-3 py-2 rounded-lg text-sm shadow-sm text-center min-w-[120px] max-w-[180px]"
      title={nodeTooltipTitle(data, coordTitle)}
      style={{
        background: chrome.bg,
        border: `2px ${chrome.borderStyle} ${chrome.border}`,
        color: 'var(--text)',
        opacity: chrome.opacity,
        outline: selected ? '2px solid var(--accent)' : undefined,
        outlineOffset: 2,
      }}
    >
      <Handle type="target" position={Position.Left} className="!bg-slate-400 !w-2.5 !h-2.5" />
      <div className="font-medium leading-tight break-words">{data.label}</div>
      {entryLine && <div className="text-[10px] text-slate-500 mt-0.5">{entryLine}</div>}
      {volumeLines.map((line) => (
        <div key={line} className={`text-[10px] mt-0.5 ${chrome.volumeClass}`}>
          {line}
        </div>
      ))}
      <Handle type="source" position={Position.Right} className="!bg-slate-400 !w-2.5 !h-2.5" />
    </div>
  );
});

const SandLegLabelNode = memo(function SandLegLabelNode({
  data,
}: NodeProps<Node<SandLegLabelNodeData>>) {
  const text = formatSandEdgeM3(data.flowM3);
  return (
    <div
      className="sand-flow-leg-label pointer-events-none"
      style={{
        transform: 'translate(-50%, -50%)',
        padding: '2px 10px',
        borderRadius: 10,
        fontSize: 11,
        fontWeight: 600,
        color: '#b45309',
        background: 'var(--surface, #fff)',
        border: '1.5px solid #b45309',
        whiteSpace: 'nowrap',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      }}
    >
      {text}
    </div>
  );
});

const SandPlannedLegLabelNode = memo(function SandPlannedLegLabelNode({
  data,
}: NodeProps<Node<SandPlannedLegLabelNodeData>>) {
  return (
    <div
      className="sand-flow-leg-label pointer-events-none"
      style={{
        transform: 'translate(-50%, -50%)',
        padding: '2px 10px',
        borderRadius: 10,
        fontSize: 10,
        fontWeight: 600,
        color: '#64748b',
        background: 'var(--surface, #fff)',
        border: '1.5px dashed #94a3b8',
        whiteSpace: 'nowrap',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      {data.label}
    </div>
  );
});

export const nodeTypes = {
  sandFlowNode: SandFlowNode,
  sandNetworkNode: SandNetworkNode,
  sandLegLabel: SandLegLabelNode,
  sandPlannedLegLabel: SandPlannedLegLabelNode,
};
