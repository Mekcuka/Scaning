import { createContext, memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  BaseEdge,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { LayoutGrid, MousePointer2 } from 'lucide-react';
import { AppSelect } from '../AppSelect';
import { FlowSchematicEditPanel } from '../FlowSchematicEditPanel';
import type { SandLogisticsSubnet } from '../../lib/api';
import {
  computeSandEdgePath,
  enforceSandFlowSitesNoOverlap,
  formatSandEdgeM3,
  sandLogisticsToFlow,
  SAND_FLOW_SITE_GAP,
  SAND_FLOW_SITE_H,
  SAND_FLOW_SITE_W,
  SAND_LOGISTICS_LINE_STYLE_OPTIONS,
  type SandRoadEdgeData,
  type SandFlowNodeData,
  type SandLogisticsLineStyle,
} from '../../lib/sandLogisticsFlow';
import {
  loadSandLogisticsLineStyle,
  saveSandLogisticsLineStyle,
} from '../../lib/sandLogisticsResult';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useFlowSchematicContext } from '../../pages/flows/flowSchematicContext';

const LineStyleContext = createContext<SandLogisticsLineStyle>('straight');

function useSandLineStyle(): SandLogisticsLineStyle {
  return useContext(LineStyleContext);
}

const SandRoadEdge = memo(function SandRoadEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  data,
}: EdgeProps<Edge<SandRoadEdgeData>>) {
  const lineStyle = useSandLineStyle();
  const flowM3 = data?.flowM3 ?? 0;
  const hasFlow = flowM3 > 0;
  const [edgePath, labelX, labelY] = computeSandEdgePath(lineStyle, {
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const offsetX = data?.labelOffsetX ?? 0;
  const offsetY = data?.labelOffsetY ?? 0;
  const lx = labelX + offsetX;
  const ly = labelY + offsetY;

  const stroke = (style?.stroke as string) ?? (hasFlow ? '#b45309' : '#cbd5e1');
  const label = hasFlow ? formatSandEdgeM3(flowM3) : '';

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={style}
        markerEnd={
          hasFlow
            ? ((markerEnd ?? {
                type: MarkerType.ArrowClosed,
                color: stroke,
              }) as EdgeProps['markerEnd'])
            : undefined
        }
      />
      {hasFlow && (
        <g pointerEvents="none" className="sand-flow-edge-label">
          <rect
            x={lx - label.length * 3.2 - 8}
            y={ly - 10}
            width={label.length * 6.4 + 16}
            height={20}
            rx={10}
            fill="var(--surface, #fff)"
            stroke={stroke}
            strokeWidth={1.5}
          />
          <text
            x={lx}
            y={ly}
            textAnchor="middle"
            dominantBaseline="central"
            fill={stroke}
            fontSize={11}
            fontWeight={600}
          >
            {label}
          </text>
        </g>
      )}
    </>
  );
});

const SandSiteLinkEdge = memo(function SandSiteLinkEdge(props: EdgeProps) {
  const lineStyle = useSandLineStyle();
  const [edgePath] = computeSandEdgePath(lineStyle, props);
  return <BaseEdge id={props.id} path={edgePath} style={props.style} />;
});

const SandNetworkNode = memo(function SandNetworkNode() {
  return (
    <div
      className="rounded-full bg-slate-300 border border-slate-400"
      style={{ width: 8, height: 8 }}
    >
      <Handle type="target" position={Position.Left} className="!opacity-0 !w-px !h-px" />
      <Handle type="source" position={Position.Right} className="!opacity-0 !w-px !h-px" />
    </div>
  );
});

const SandFlowNode = memo(function SandFlowNode({ data, selected }: NodeProps<Node<SandFlowNodeData>>) {
  const isQuarry = data.kind === 'quarry';
  const inactive = data.in_service === false;

  let border: string;
  let bg: string;
  if (inactive) {
    border = '#94a3b8';
    bg = '#f1f5f9';
  } else if (isQuarry) {
    border = '#d97706';
    bg = '#fffbeb';
  } else {
    const demand = data.demand_m3 ?? 0;
    const allocated = data.allocated_m3 ?? 0;
    const met = demand <= 0 || allocated >= demand - 1e-6;
    if (met) {
      border = '#16a34a';
      bg = '#f0fdf4';
    } else {
      border = '#dc2626';
      bg = '#fef2f2';
    }
  }

  const showDemandLine =
    !isQuarry &&
    data.in_service !== false &&
    (data.demand_m3 ?? 0) > 0;
  const demandMet =
    showDemandLine && (data.allocated_m3 ?? 0) >= (data.demand_m3 ?? 0) - 1e-6;

  const coordTitle =
    data.lon != null && data.lat != null
      ? `${data.lat.toFixed(6)}, ${data.lon.toFixed(6)}`
      : undefined;

  return (
    <div
      className="flow-schematic-node px-3 py-2 rounded-lg text-sm shadow-sm text-center min-w-[120px] max-w-[180px]"
      title={coordTitle}
      style={{
        background: bg,
        border: `2px solid ${border}`,
        color: 'var(--text)',
        opacity: inactive ? 0.7 : 1,
        outline: selected ? '2px solid var(--accent)' : undefined,
        outlineOffset: 2,
      }}
    >
      <Handle type="target" position={Position.Left} className="!bg-slate-400 !w-2.5 !h-2.5" />
      <div className="font-medium leading-tight break-words">{data.label}</div>
      {inactive && <div className="text-[10px] text-slate-500 mt-0.5">не введён</div>}
      {showDemandLine && (
        <div
          className={`text-[10px] mt-0.5 ${demandMet ? 'text-green-700' : 'text-red-700'}`}
        >
          {(data.allocated_m3 ?? 0).toLocaleString('ru-RU')} /{' '}
          {(data.demand_m3 ?? 0).toLocaleString('ru-RU')} м³
        </div>
      )}
      <Handle type="source" position={Position.Right} className="!bg-slate-400 !w-2.5 !h-2.5" />
    </div>
  );
});

const nodeTypes = { sandFlowNode: SandFlowNode, sandNetworkNode: SandNetworkNode };
const edgeTypes = {
  sandRoadEdge: SandRoadEdge,
  sandSiteLinkEdge: SandSiteLinkEdge,
};

type FlowCanvasProps = {
  syncKey: string;
  initialNodes: Node<SandFlowNodeData>[];
  initialEdges: Edge[];
  isMobile: boolean;
  lineStyle: SandLogisticsLineStyle;
  onLineStyleChange: (style: SandLogisticsLineStyle) => void;
};

const SandLogisticsFlowCanvas = memo(function SandLogisticsFlowCanvas({
  syncKey,
  initialNodes,
  initialEdges,
  isMobile,
  lineStyle,
  onLineStyleChange,
}: FlowCanvasProps) {
  const { fitView } = useReactFlow();
  const fitOnce = useRef(false);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
    fitOnce.current = false;
  }, [syncKey, initialNodes, initialEdges, setNodes, setEdges]);

  useEffect(() => {
    if (fitOnce.current || initialNodes.length === 0) return;
    fitOnce.current = true;
    requestAnimationFrame(() => {
      fitView({ padding: 0.2, duration: 0 });
    });
  }, [syncKey, initialNodes.length, fitView]);

  const resetLayout = useCallback(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
    fitOnce.current = false;
    requestAnimationFrame(() => {
      fitView({ padding: 0.2, duration: 0 });
    });
  }, [initialNodes, initialEdges, setNodes, setEdges, fitView]);

  const handleLineStyleChange = useCallback(
    (value: string) => {
      if (value === 'straight' || value === 'bezier' || value === 'smoothstep') {
        onLineStyleChange(value);
      }
    },
    [onLineStyleChange]
  );

  const resolveSiteNodeOverlaps = useCallback(
    (nds: Node<SandFlowNodeData>[], movedNodeId?: string) => {
      const siteNodes = nds.filter((n) => n.type === 'sandFlowNode');
      if (siteNodes.length < 2) return nds;

      const layoutRects = siteNodes.map((n) => ({
        id: n.id,
        x: n.position.x,
        y: n.position.y,
        w: SAND_FLOW_SITE_W,
        h: SAND_FLOW_SITE_H,
      }));

      if (movedNodeId) {
        const moved = layoutRects.find((r) => r.id === movedNodeId);
        const others = layoutRects.filter((r) => r.id !== movedNodeId);
        if (moved) {
          for (let pass = 0; pass < 80; pass++) {
            let shifted = false;
            for (const other of others) {
              if (
                moved.x < other.x + other.w + SAND_FLOW_SITE_GAP &&
                moved.x + moved.w + SAND_FLOW_SITE_GAP > other.x &&
                moved.y < other.y + other.h + SAND_FLOW_SITE_GAP &&
                moved.y + moved.h + SAND_FLOW_SITE_GAP > other.y
              ) {
                const mcx = moved.x + moved.w / 2;
                const mcy = moved.y + moved.h / 2;
                const ocx = other.x + other.w / 2;
                const ocy = other.y + other.h / 2;
                const overlapX =
                  (moved.w + other.w) / 2 + SAND_FLOW_SITE_GAP - Math.abs(mcx - ocx);
                const overlapY =
                  (moved.h + other.h) / 2 + SAND_FLOW_SITE_GAP - Math.abs(mcy - ocy);
                if (overlapX <= 0 || overlapY <= 0) continue;
                if (overlapX < overlapY) {
                  moved.x += (overlapX + 1) * (mcx >= ocx ? 1 : -1);
                } else {
                  moved.y += (overlapY + 1) * (mcy >= ocy ? 1 : -1);
                }
                shifted = true;
              }
            }
            if (!shifted) break;
          }
        }
      } else {
        enforceSandFlowSitesNoOverlap(layoutRects, SAND_FLOW_SITE_GAP);
      }

      const byId = new Map(layoutRects.map((r) => [r.id, r]));
      return nds.map((n) => {
        const next = byId.get(n.id);
        return next ? { ...n, position: { x: next.x, y: next.y } } : n;
      });
    },
    []
  );

  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type !== 'sandFlowNode') return;
      setNodes((nds) => resolveSiteNodeOverlaps(nds, node.id));
    },
    [resolveSiteNodeOverlaps, setNodes]
  );

  return (
    <LineStyleContext.Provider value={lineStyle}>
      <div className="flow-schematic-stage">
        <div className="flow-schematic-canvas w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] h-[min(58vh,520px)]">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onNodeDragStop={onNodeDragStop}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            nodesDraggable
            nodesConnectable={false}
            elementsSelectable
            panOnDrag
            zoomOnPinch
            zoomOnScroll={!isMobile}
            selectionOnDrag={false}
            selectionKeyCode="Shift"
            onlyRenderVisibleElements
            minZoom={0.12}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={16} color="var(--border)" />
            <Controls showInteractive={false} position="bottom-left" />
          </ReactFlow>
        </div>

        <FlowSchematicEditPanel
          panelId="sand-logistics"
          title="Схема"
          ariaLabel="Просмотр схемы движения песка"
        >
          <div className="flow-schematic-edit-panel-section">
            <span className="flow-schematic-edit-panel-label">Инструмент</span>
            <button type="button" className="btn btn-sm btn-primary w-full justify-start" disabled>
              <MousePointer2 size={16} />
              Выбор
            </button>
            <p className="flow-schematic-edit-panel-hint">
              ЛКМ — перемещение (блоки не накладываются). «По карте» — раскладка по координатам.
            </p>
          </div>
          <div className="flow-schematic-edit-panel-section">
            <span className="flow-schematic-edit-panel-label">Линии</span>
            <AppSelect
              variant="sm"
              fullWidth
              ariaLabel="Форма линий на схеме"
              options={SAND_LOGISTICS_LINE_STYLE_OPTIONS}
              value={lineStyle}
              onChange={handleLineStyleChange}
            />
            <p className="flow-schematic-edit-panel-hint">
              Прямые повторяют геометрию дорог на карте; изгибы и ступеньки — для читаемости при
              плотной раскладке.
            </p>
          </div>
          <div className="flow-schematic-edit-panel-section">
            <span className="flow-schematic-edit-panel-label">Действия</span>
            <button
              type="button"
              className="btn btn-sm btn-ghost w-full justify-start"
              onClick={resetLayout}
              title="Восстановить раскладку"
            >
              <LayoutGrid size={16} />
              По карте
            </button>
          </div>
        </FlowSchematicEditPanel>
      </div>
    </LineStyleContext.Provider>
  );
});

function SandLogisticsFlowSchematicInner({ subnet }: { subnet: SandLogisticsSubnet }) {
  const { projectId } = useFlowSchematicContext();
  const isMobile = useIsMobile();
  const syncKey = useMemo(() => JSON.stringify(subnet), [subnet]);
  const built = useMemo(() => sandLogisticsToFlow(subnet), [syncKey, subnet]);
  const { summary, nodes: initialNodes, edges: initialEdges } = built;

  const [lineStyle, setLineStyle] = useState<SandLogisticsLineStyle>(() =>
    projectId ? loadSandLogisticsLineStyle(projectId) : 'straight'
  );

  useEffect(() => {
    if (!projectId) return;
    setLineStyle(loadSandLogisticsLineStyle(projectId));
  }, [projectId]);

  const handleLineStyleChange = useCallback(
    (style: SandLogisticsLineStyle) => {
      setLineStyle(style);
      if (projectId) saveSandLogisticsLineStyle(projectId, style);
    },
    [projectId]
  );

  if (subnet.quarries.length === 0 && subnet.consumers.length === 0) {
    return (
      <p className="text-sm text-[var(--text-muted)] py-6 text-center">
        Нет карьеров и потребителей для схемы движения.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-4 text-sm">
        <span>
          Спрос: <strong>{summary.total_demand_m3.toLocaleString('ru-RU')} м³</strong>
        </span>
        <span>
          Отгружено: <strong>{summary.total_allocated_m3.toLocaleString('ru-RU')} м³</strong>
        </span>
        {summary.unmet_m3 > 0 && (
          <span className="text-amber-700">
            Не покрыто: <strong>{summary.unmet_m3.toLocaleString('ru-RU')} м³</strong>
          </span>
        )}
      </div>
      <p className="text-xs text-[var(--text-muted)]">
        Блоки и дороги размещаются по координатам карты (lon/lat). Серые линии — автодороги без
        потока; оранжевые — участки с движением песка (кратчайший путь
        Dijkstra) с подписью{' '}
        <span className="flow-edge-label flow-edge-label-inline">м³</span>
        . Пунктир — подъезд от карьера/потребителя до узла дороги. На потребителях — отгружено / спрос (м³);{' '}
        <span className="text-green-700 font-medium">зелёный</span> — спрос покрыт,{' '}
        <span className="text-red-700 font-medium">красный</span> — не хватило песка.
      </p>

      <SandLogisticsFlowCanvas
        syncKey={syncKey}
        initialNodes={initialNodes}
        initialEdges={initialEdges}
        isMobile={isMobile}
        lineStyle={lineStyle}
        onLineStyleChange={handleLineStyleChange}
      />
    </div>
  );
}

export function SandLogisticsFlowSchematic({ subnet }: { subnet: SandLogisticsSubnet }) {
  return (
    <ReactFlowProvider>
      <SandLogisticsFlowSchematicInner subnet={subnet} />
    </ReactFlowProvider>
  );
}
