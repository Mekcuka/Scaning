import { useRef, useState } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { FlowNodeData } from '../../lib/flowSchematic';
import {
  DEFAULT_SEPARATION_PERCENT,
  FLUID_COLORS,
  kindStyle,
} from '../../lib/flowSchematic';
import { useFlowPropagation, useFlowSchematicActions } from '../../lib/flowSchematicContext';
import { DeferredNumberInput } from '../DeferredNumberInput';
import { FlowCapacityPopover } from './FlowCapacityPopover';

export function FlowNode({ id, data, selected }: NodeProps<Node<FlowNodeData>>) {
  const flowMap = useFlowPropagation();
  const actions = useFlowSchematicActions();
  const fs = flowMap.get(id);
  const flowAnnual = fs?.flowAnnual ?? data.flow_annual ?? null;
  const flowUnit = fs?.flowUnit ?? data.flow_unit ?? null;
  const over = fs?.overCapacity ?? data.over_capacity === true;
  const [popoverOpen, setPopoverOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const style = kindStyle(data.kind, data.fluid);
  const accent = over
    ? '#dc2626'
    : data.fluid && FLUID_COLORS[data.fluid]
      ? FLUID_COLORS[data.fluid]
      : style.border;
  const bg = over ? '#fef2f2' : style.bg;
  const isSeparator = data.kind === 'separator';
  const separationPercent = data.separation_percent ?? DEFAULT_SEPARATION_PERCENT;

  const clearCloseTimer = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const scheduleClose = () => {
    clearCloseTimer();
    closeTimer.current = setTimeout(() => setPopoverOpen(false), 200);
  };

  return (
    <div
      className="relative"
      onMouseEnter={() => {
        clearCloseTimer();
        setPopoverOpen(true);
      }}
      onMouseLeave={scheduleClose}
    >
      <FlowCapacityPopover
        nodeId={id}
        data={data}
        flowAnnual={flowAnnual}
        flowUnit={flowUnit}
        overCapacity={over}
        open={popoverOpen}
        onOpenChange={(next) => {
          clearCloseTimer();
          setPopoverOpen(next);
        }}
      />
      <div
        className={`flow-schematic-node px-3 py-2 rounded-lg text-sm shadow-sm text-center ${
          isSeparator ? 'min-w-[130px] max-w-[150px] w-fit' : 'min-w-[120px] max-w-[220px]'
        }`}
        style={{
          background: bg,
          border: `2px solid ${accent}`,
          boxShadow: over ? '0 0 0 1px rgba(220, 38, 38, 0.35)' : undefined,
          outline: selected ? `2px solid var(--accent)` : undefined,
          outlineOffset: 2,
          color: 'var(--text)',
        }}
      >
        <Handle type="target" position={Position.Left} className="!bg-slate-400 !w-2.5 !h-2.5" />
        <div className="font-medium leading-tight break-words">{data.label}</div>
        {isSeparator && (
          <div
            className="mt-1 flex items-center justify-center gap-1 text-[10px] text-slate-600"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <span className="whitespace-nowrap">Нефть:</span>
            <DeferredNumberInput
              native
              value={separationPercent}
              integer
              min={1}
              max={100}
              className="w-11 px-1 py-0.5 rounded border border-slate-300 text-center text-[10px] bg-white text-[#0f1c2e]"
              title="Доля нефти в скважинной жидкости (для оценки жидкости на сепараторе)"
              onKeyDown={(e) => e.stopPropagation()}
              onCommit={(v) => actions?.onSeparationPercentChange(id, v as number)}
            />
            <span>%</span>
          </div>
        )}
        <Handle type="source" position={Position.Right} className="!bg-slate-400 !w-2.5 !h-2.5" />
      </div>
    </div>
  );
}
