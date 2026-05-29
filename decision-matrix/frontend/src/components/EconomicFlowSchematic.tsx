import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { LayoutGrid, MousePointer2 } from 'lucide-react';
import type { EconomicFlowSchematicDto, EconomicNodeData } from '../lib/economicFlowSchematic';
import {
  ECONOMIC_WARNING_LABELS,
  formatMlnRub,
  schematicToEconomicFlow,
  thousandToMlnDisplay,
} from '../lib/economicFlowSchematic';
import { formatCapacity, kindStyle, layoutWithDagre } from '../lib/flowSchematic';
import { useIsMobile } from '../hooks/useMediaQuery';

function EconomicNode({ data, selected }: NodeProps<Node<EconomicNodeData>>) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const style = kindStyle(data.kind, data.fluid);
  const hasRevenue = (data.revenue_thousand_rub_per_year ?? 0) > 0;
  const negativeNet = (data.net_thousand_rub_per_year ?? 0) < 0;
  const accent = hasRevenue ? '#059669' : negativeNet ? '#dc2626' : style.border;
  const bg = negativeNet ? '#fef2f2' : hasRevenue ? '#ecfdf5' : style.bg;

  const clearCloseTimer = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  return (
    <div
      className="relative"
      onMouseEnter={() => {
        clearCloseTimer();
        setOpen(true);
      }}
      onMouseLeave={() => {
        clearCloseTimer();
        closeTimer.current = setTimeout(() => setOpen(false), 200);
      }}
    >
      {open && data.formula_label && (
        <div className="absolute z-50 left-1/2 -translate-x-1/2 bottom-full mb-1 w-[240px] rounded-lg border border-[var(--border)] bg-white text-[#0f1c2e] px-3 py-2 text-xs shadow-lg">
          <div className="font-semibold mb-1">{data.label}</div>
          {data.flow_annual != null && (
            <div className="text-slate-500 mb-1">
              Поток: {formatCapacity(data.flow_annual, data.flow_unit)}
            </div>
          )}
          {data.formula_label?.split('; ').map((line) => (
            <div key={line} className="text-slate-600 leading-snug">
              {line}
            </div>
          ))}
        </div>
      )}
      <div
        className="flow-schematic-node px-3 py-2 rounded-lg text-xs shadow-sm text-center min-w-[130px] max-w-[220px]"
        style={{
          background: bg,
          border: `2px solid ${accent}`,
          color: 'var(--text)',
          outline: selected ? '2px solid var(--accent)' : undefined,
          outlineOffset: 2,
        }}
      >
        <Handle type="target" position={Position.Left} className="!bg-slate-400 !w-2 !h-2" />
        <div className="font-medium leading-tight mb-1">{data.label}</div>
        <div className="space-y-0.5 text-[10px] tabular-nums">
          <div>
            CAPEX:{' '}
            <span className="font-medium">{thousandToMlnDisplay(data.capex_thousand_rub)}</span>
          </div>
          <div>
            OPEX/год:{' '}
            <span className="font-medium">
              {thousandToMlnDisplay(data.opex_thousand_rub_per_year)}
            </span>
          </div>
          <div>
            Выручка/год:{' '}
            <span className="font-medium">
              {thousandToMlnDisplay(data.revenue_thousand_rub_per_year)}
            </span>
          </div>
        </div>
        <Handle type="source" position={Position.Right} className="!bg-slate-400 !w-2 !h-2" />
      </div>
    </div>
  );
}

const nodeTypes = { economicNode: EconomicNode };

function buildGraph(schematic: EconomicFlowSchematicDto) {
  const initial = schematicToEconomicFlow(schematic);
  const hasPositions = initial.nodes.some((n) => n.position.x !== 0 || n.position.y !== 0);
  if (hasPositions) return initial;
  return {
    nodes: layoutWithDagre(initial.nodes, initial.edges),
    edges: initial.edges,
  };
}

function EconomicFlowSchematicInner({ schematic }: { schematic: EconomicFlowSchematicDto }) {
  const isMobile = useIsMobile();
  const initial = useMemo(() => buildGraph(schematic), [schematic]);
  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);

  const syncKey = useMemo(
    () =>
      JSON.stringify({
        poi_id: schematic.poi_id,
        nodes: schematic.nodes,
        edges: schematic.edges,
        summary: schematic.summary,
      }),
    [schematic]
  );

  useEffect(() => {
    const next = buildGraph(schematic);
    setNodes(next.nodes);
    setEdges(next.edges);
  }, [syncKey, schematic, setNodes, setEdges]);

  const autoLayout = useCallback(() => {
    setNodes((nds) => layoutWithDagre(nds, edges));
  }, [edges, setNodes]);

  return (
    <div className="flex flex-col gap-3">
      <div className="economic-flow-summary flex flex-wrap gap-4 text-sm">
        <span>
          CAPEX: <strong>{formatMlnRub(schematic.summary.total_capex_mln)}</strong>
        </span>
        <span>
          OPEX/год: <strong>{formatMlnRub(schematic.summary.total_opex_mln_per_year)}</strong>
        </span>
        <span>
          Выручка/год:{' '}
          <strong>{formatMlnRub(schematic.summary.total_revenue_mln_per_year)}</strong>
        </span>
        <span>
          Net/год: <strong>{formatMlnRub(schematic.summary.net_mln_per_year)}</strong>
        </span>
      </div>

      {schematic.warnings.length > 0 && (
        <ul className="text-xs text-amber-700 space-y-1 list-disc pl-4">
          {schematic.warnings.map((w) => (
            <li key={w}>{ECONOMIC_WARNING_LABELS[w] ?? w}</li>
          ))}
        </ul>
      )}

      <div className="flow-schematic-stage">
        <div className="flow-schematic-canvas w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] h-[min(40vh,400px)]">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            nodesDraggable
            nodesConnectable={false}
            elementsSelectable
            panOnDrag
            zoomOnPinch
            zoomOnScroll={!isMobile}
            selectionOnDrag={false}
            selectionKeyCode="Shift"
            fitView
            fitViewOptions={{ padding: 0.2 }}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={16} color="var(--border)" />
            <Controls showInteractive={false} position="bottom-left" />
          </ReactFlow>
        </div>

        <aside className="flow-schematic-edit-panel" aria-label="Просмотр экономической схемы">
          <div className="flow-schematic-edit-panel-head">
            <h3 className="flow-schematic-edit-panel-title">Схема</h3>
          </div>

          <div className="flow-schematic-edit-panel-section">
            <span className="flow-schematic-edit-panel-label">Инструмент</span>
            <button type="button" className="btn btn-sm btn-primary w-full justify-start" disabled>
              <MousePointer2 size={16} />
              Выбор
            </button>
            <p className="flow-schematic-edit-panel-hint">
              ЛКМ по полю — перемещение. Shift + ЛКМ — рамка выделения. Перетаскивайте блоки для
              удобства просмотра.
            </p>
          </div>

          <div className="flow-schematic-edit-panel-section">
            <span className="flow-schematic-edit-panel-label">Действия</span>
            <button
              type="button"
              className="btn btn-sm btn-ghost w-full justify-start"
              onClick={autoLayout}
              title="Авто-раскладка"
            >
              <LayoutGrid size={16} />
              Раскладка
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

export function EconomicFlowSchematic({ schematic }: { schematic: EconomicFlowSchematicDto }) {
  return (
    <ReactFlowProvider>
      <EconomicFlowSchematicInner schematic={schematic} />
    </ReactFlowProvider>
  );
}
