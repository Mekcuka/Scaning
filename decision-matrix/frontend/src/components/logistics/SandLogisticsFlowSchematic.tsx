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
  formatSandEdgeM3,
  sandLogisticsToFlow,
  SAND_LOGISTICS_LINE_STYLE_OPTIONS,
  type SandFlowEdgeData,
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

function SandNetworkEdge(props: EdgeProps) {
  const lineStyle = useSandLineStyle();
  const [edgePath] = computeSandEdgePath(lineStyle, props);
  return <BaseEdge id={props.id} path={edgePath} style={props.style} />;
}

const SandFlowEdge = memo(function SandFlowEdge({
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
}: EdgeProps<Edge<SandFlowEdgeData>>) {
  const lineStyle = useSandLineStyle();
  const d = data ?? { variant: 'flow' };
  const [edgePath, labelX, labelY] = computeSandEdgePath(lineStyle, {
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const stroke = (style?.stroke as string) ?? '#b45309';
  const showLabel = d.variant === 'flow' && d.showLabel && d.flowM3 != null && d.flowM3 > 0;
  const label = showLabel ? formatSandEdgeM3(d.flowM3!) : '';

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={style}
        markerEnd={
          (markerEnd ?? { type: MarkerType.ArrowClosed, color: stroke }) as EdgeProps['markerEnd']
        }
      />
      {showLabel && (
        <g pointerEvents="none" className="sand-flow-edge-label">
          <rect
            x={labelX - label.length * 3.2 - 8}
            y={labelY - 10}
            width={label.length * 6.4 + 16}
            height={20}
            rx={10}
            fill="var(--surface, #fff)"
            stroke={stroke}
            strokeWidth={1.5}
          />
          <text
            x={labelX}
            y={labelY}
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

  const showShortfall =
    !isQuarry &&
    data.in_service !== false &&
    (data.demand_m3 ?? 0) > 0 &&
    (data.allocated_m3 ?? 0) < (data.demand_m3 ?? 0) - 1e-6;

  return (
    <div
      className="flow-schematic-node px-3 py-2 rounded-lg text-sm shadow-sm text-center min-w-[120px] max-w-[180px]"
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
      {showShortfall && (
        <div className="text-[10px] text-red-700 mt-0.5">
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
  sandNetworkEdge: SandNetworkEdge,
  sandFlowEdge: SandFlowEdge,
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

  return (
    <LineStyleContext.Provider value={lineStyle}>
      <div className="flow-schematic-stage">
        <div className="flow-schematic-canvas w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] h-[min(58vh,520px)]">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
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
              ЛКМ — перемещение. Блоки можно перетаскивать; «По карте» — раскладка без наложений.
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
        Серые линии и точки — автодороги и узлы сети. Оранжевые участки — поток песка по маршруту
        (кратчайший путь Dijkstra) с подписью{' '}
        <span className="flow-edge-label flow-edge-label-inline">м³</span>
        . Пунктир — подъезд от карьера/потребителя до узла дороги. Потребители:{' '}
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
