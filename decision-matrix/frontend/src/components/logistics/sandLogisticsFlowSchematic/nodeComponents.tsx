import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import {
  formatSandEdgeFlow,
  formatSandEdgeM3Full,
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
      <Handle type="target" position={Position.Top} id="target-top" className="!opacity-0 !w-px !h-px" />
      <Handle type="target" position={Position.Right} id="target-right" className="!opacity-0 !w-px !h-px" />
      <Handle type="target" position={Position.Bottom} id="target-bottom" className="!opacity-0 !w-px !h-px" />
      <Handle type="target" position={Position.Left} id="target-left" className="!opacity-0 !w-px !h-px" />
      <Handle type="source" position={Position.Top} id="source-top" className="!opacity-0 !w-px !h-px" />
      <Handle type="source" position={Position.Right} id="source-right" className="!opacity-0 !w-px !h-px" />
      <Handle type="source" position={Position.Bottom} id="source-bottom" className="!opacity-0 !w-px !h-px" />
      <Handle type="source" position={Position.Left} id="source-left" className="!opacity-0 !w-px !h-px" />
    </div>
  );
});

const FLOW_NODE_HANDLE_POSITIONS = [
  Position.Top,
  Position.Right,
  Position.Bottom,
  Position.Left,
] as const;

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
      className="sand-flow-node flow-schematic-node px-2.5 py-1.5 rounded-lg text-xs text-center min-w-[110px] max-w-[150px] cursor-grab active:cursor-grabbing"
      title={nodeTooltipTitle(data, coordTitle)}
      style={{
        background: chrome.bg,
        border: `2px ${chrome.borderStyle} ${chrome.border}`,
        color: 'var(--text)',
        opacity: chrome.opacity,
        outline: selected ? '2px solid var(--accent)' : undefined,
        outlineOffset: 2,
        boxShadow: selected
          ? '0 0 0 3px color-mix(in srgb, var(--accent) 25%, transparent)'
          : '0 1px 3px rgba(15, 23, 42, 0.08)',
      }}
    >
      {FLOW_NODE_HANDLE_POSITIONS.map((pos) => (
        <Handle
          key={`target-${pos}`}
          type="target"
          position={pos}
          id={`target-${pos}`}
          className="!opacity-0 !w-px !h-px"
        />
      ))}
      <div className="font-medium leading-tight break-words text-[13px]">{data.label}</div>
      {entryLine && <div className="text-[10px] text-slate-500 mt-0.5">{entryLine}</div>}
      {volumeLines.map((line) => (
        <div key={line} className={`text-[10px] mt-0.5 ${chrome.volumeClass}`}>
          {line}
        </div>
      ))}
      {FLOW_NODE_HANDLE_POSITIONS.map((pos) => (
        <Handle
          key={`source-${pos}`}
          type="source"
          position={pos}
          id={`source-${pos}`}
          className="!opacity-0 !w-px !h-px"
        />
      ))}
    </div>
  );
});

const SandLegLabelNode = memo(function SandLegLabelNode({
  data,
}: NodeProps<Node<SandLegLabelNodeData>>) {
  return (
    <div
      className="flow-edge-label sand-flow-leg-label pointer-events-none nodrag"
      style={{
        transform: 'translate(-50%, -50%)',
        borderColor: '#b45309',
        color: '#b45309',
      }}
      title={formatSandEdgeM3Full(data.flowM3)}
    >
      {formatSandEdgeFlow(data.flowM3)}
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
