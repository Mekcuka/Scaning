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
import { formatEntryDateRu } from '../../lib/infraEntryDate';
import {
  buildSandLogisticsLayout,
  buildSandLogisticsSliceFlow,
  computeSandLogisticsSliceKey,
  computeSandLogisticsTopologyKey,
  computeSandEdgePath,
  computeSandFlowDefaultViewport,
  enforceSandFlowSitesNoOverlap,
  formatSandEdgeM3,
  mergeSliceFlowNodes,
  polylineToSvgPath,
  SAND_FLOW_NET_SIZE,
  SAND_FLOW_SITE_GAP,
  SAND_FLOW_SITE_H,
  SAND_FLOW_SITE_W,
  SAND_LOGISTICS_EDGE_LABEL_MODE_OPTIONS,
  SAND_LOGISTICS_LINE_STYLE_OPTIONS,
  SAND_LOGISTICS_NODE_FILTER_OPTIONS,
  type SandLegLabelNodeData,
  type SandLogisticsEdgeLabelMode,
  type SandLogisticsNodeFilterMode,
  type SandPlannedLegLabelNodeData,
  type SandRoadEdgeData,
  type SandRoadPolylineEdgeData,
  type SandFlowNodeData,
  type SandLogisticsLineStyle,
} from '../../lib/sandLogisticsFlow';
import {
  consumerVolumeLines,
  ENTRY_YEAR_LANE_COLORS,
  entryDateLine,
  nodeChromeForStatus,
  nodeTooltipTitle,
  quarryVolumeLines,
  resolveSandConsumerNodeStatus,
  resolveSandNodeStatus,
  resolveSandQuarryNodeStatus,
} from '../../lib/sandLogisticsNodeVisual';
import {
  loadSandLogisticsEdgeLabelMode,
  loadSandLogisticsGroupByEntryYear,
  loadSandLogisticsLineStyle,
  loadSandLogisticsNodeFilterMode,
  loadSandLogisticsShowPlannedRoutes,
  saveSandLogisticsEdgeLabelMode,
  saveSandLogisticsGroupByEntryYear,
  saveSandLogisticsLineStyle,
  saveSandLogisticsNodeFilterMode,
  saveSandLogisticsShowPlannedRoutes,
} from '../../lib/sandLogisticsResult';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useFlowSchematicContext } from '../../pages/flows/flowSchematicContext';
import { SandLogisticsSchematicTimeline } from './SandLogisticsSchematicTimeline';

const LineStyleContext = createContext<SandLogisticsLineStyle>('straight');
const EdgeLabelModeContext = createContext<SandLogisticsEdgeLabelMode>('key');

function useSandLineStyle(): SandLogisticsLineStyle {
  return useContext(LineStyleContext);
}

function useSandEdgeLabelMode(): SandLogisticsEdgeLabelMode {
  return useContext(EdgeLabelModeContext);
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
  const edgeLabelMode = useSandEdgeLabelMode();
  const flowM3 = data?.flowM3 ?? 0;
  const hasFlow = flowM3 > 0;
  const showSegmentLabel = edgeLabelMode === 'all' && hasFlow;
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
  const label = showSegmentLabel ? formatSandEdgeM3(flowM3) : '';

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
      {showSegmentLabel && (
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

const SandRoadPolylineEdge = memo(function SandRoadPolylineEdge({
  id,
  style,
  markerEnd,
  data,
}: EdgeProps<Edge<SandRoadPolylineEdgeData>>) {
  const lineStyle = useSandLineStyle();
  const edgeLabelMode = useSandEdgeLabelMode();
  const points = data?.points ?? [];
  const flowM3 = data?.flowM3 ?? 0;
  const hasFlow = flowM3 > 0;
  const showSegmentLabel = edgeLabelMode === 'all' && hasFlow;
  const [edgePath, labelX, labelY] = polylineToSvgPath(lineStyle, points);
  if (!edgePath) return null;
  const offsetX = data?.labelOffsetX ?? 0;
  const offsetY = data?.labelOffsetY ?? 0;
  const lx = labelX + offsetX;
  const ly = labelY + offsetY;
  const stroke = (style?.stroke as string) ?? (hasFlow ? '#b45309' : '#cbd5e1');
  const label = showSegmentLabel ? formatSandEdgeM3(flowM3) : '';

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
      {showSegmentLabel && (
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

const SandPlannedRoadPolylineEdge = memo(function SandPlannedRoadPolylineEdge({
  id,
  style,
  data,
}: EdgeProps<Edge<SandRoadPolylineEdgeData>>) {
  const lineStyle = useSandLineStyle();
  const [edgePath] = polylineToSvgPath(lineStyle, data?.points ?? []);
  if (!edgePath) return null;
  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={{
        stroke: '#64748b',
        strokeWidth: 2,
        strokeDasharray: '6 4',
        ...style,
      }}
    />
  );
});

const SandSiteLinkEdge = memo(function SandSiteLinkEdge(props: EdgeProps) {
  const lineStyle = useSandLineStyle();
  const [edgePath] = computeSandEdgePath(lineStyle, props);
  return <BaseEdge id={props.id} path={edgePath} style={props.style} />;
});

const SandPlannedRoadEdge = memo(function SandPlannedRoadEdge(props: EdgeProps) {
  const lineStyle = useSandLineStyle();
  const [edgePath] = computeSandEdgePath(lineStyle, props);
  return (
    <BaseEdge
      id={props.id}
      path={edgePath}
      style={{
        stroke: '#64748b',
        strokeWidth: 2,
        strokeDasharray: '6 4',
        ...props.style,
      }}
    />
  );
});

const SandPlannedSiteLinkEdge = memo(function SandPlannedSiteLinkEdge(props: EdgeProps) {
  const lineStyle = useSandLineStyle();
  const [edgePath] = computeSandEdgePath(lineStyle, props);
  return <BaseEdge id={props.id} path={edgePath} style={props.style} />;
});

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

const nodeTypes = {
  sandFlowNode: SandFlowNode,
  sandNetworkNode: SandNetworkNode,
  sandLegLabel: SandLegLabelNode,
  sandPlannedLegLabel: SandPlannedLegLabelNode,
};
const edgeTypes = {
  sandRoadEdge: SandRoadEdge,
  sandRoadPolylineEdge: SandRoadPolylineEdge,
  sandSiteLinkEdge: SandSiteLinkEdge,
  sandPlannedRoadEdge: SandPlannedRoadEdge,
  sandPlannedRoadPolylineEdge: SandPlannedRoadPolylineEdge,
  sandPlannedSiteLinkEdge: SandPlannedSiteLinkEdge,
};

type FlowCanvasProps = {
  initialNodes: Node<SandFlowNodeData | SandLegLabelNodeData | SandPlannedLegLabelNodeData>[];
  initialEdges: Edge[];
  siteNodeIds: string[];
  defaultViewport: { x: number; y: number; zoom: number };
  isMobile: boolean;
  lineStyle: SandLogisticsLineStyle;
  edgeLabelMode: SandLogisticsEdgeLabelMode;
  nodeFilter: SandLogisticsNodeFilterMode;
  showPlannedRoutes: boolean;
  groupByEntryYear: boolean;
  onLineStyleChange: (style: SandLogisticsLineStyle) => void;
  onEdgeLabelModeChange: (mode: SandLogisticsEdgeLabelMode) => void;
  onNodeFilterChange: (mode: SandLogisticsNodeFilterMode) => void;
  onShowPlannedRoutesChange: (value: boolean) => void;
  onGroupByEntryYearChange: (value: boolean) => void;
};

function stampSandFlowLineStyle(edges: Edge[], style: SandLogisticsLineStyle): Edge[] {
  return edges.map((edge) => ({
    ...edge,
    data: { ...(edge.data ?? {}), lineStyleKey: style },
  }));
}

/** Применяет viewport внутри ReactFlow (useReactFlow только здесь). */
function SandFlowViewportSync({
  viewport,
}: {
  viewport: { x: number; y: number; zoom: number };
}) {
  const { setViewport } = useReactFlow();

  useEffect(() => {
    setViewport(viewport, { duration: 0 });
  }, [viewport, setViewport]);

  return null;
}

const SandLogisticsFlowCanvas = memo(function SandLogisticsFlowCanvas({
  initialNodes,
  initialEdges,
  siteNodeIds,
  defaultViewport,
  isMobile,
  lineStyle,
  edgeLabelMode,
  nodeFilter,
  showPlannedRoutes,
  groupByEntryYear,
  onLineStyleChange,
  onEdgeLabelModeChange,
  onNodeFilterChange,
  onShowPlannedRoutesChange,
  onGroupByEntryYearChange,
}: FlowCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ w: 720, h: 520 });
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    stampSandFlowLineStyle(initialEdges, lineStyle),
  );
  const [viewport, setViewportState] = useState(defaultViewport);

  useEffect(() => {
    setNodes((prev) => mergeSliceFlowNodes(prev, initialNodes));
    setEdges(stampSandFlowLineStyle(initialEdges, lineStyle));
  }, [initialNodes, initialEdges, lineStyle, setNodes, setEdges]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    const updateSize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w >= 32 && h >= 32) {
        setCanvasSize({ w, h });
      }
    };

    updateSize();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setEdges((current) => stampSandFlowLineStyle(current, lineStyle));
  }, [lineStyle, setEdges]);

  const resetLayout = useCallback(() => {
    setNodes(initialNodes);
    setEdges(stampSandFlowLineStyle(initialEdges, lineStyle));
    setViewportState(
      computeSandFlowDefaultViewport(
        initialNodes,
        siteNodeIds,
        canvasSize.w,
        canvasSize.h,
      ),
    );
  }, [
    initialNodes,
    initialEdges,
    lineStyle,
    siteNodeIds,
    canvasSize.w,
    canvasSize.h,
    setNodes,
    setEdges,
  ]);

  const handleLineStyleChange = useCallback(
    (value: string) => {
      if (value === 'straight' || value === 'bezier' || value === 'smoothstep') {
        onLineStyleChange(value);
      }
    },
    [onLineStyleChange]
  );

  const handleEdgeLabelModeChange = useCallback(
    (value: string) => {
      if (value === 'all' || value === 'key' || value === 'hidden') {
        onEdgeLabelModeChange(value);
      }
    },
    [onEdgeLabelModeChange]
  );

  const handleNodeFilterChange = useCallback(
    (value: string) => {
      if (value === 'all_planned' || value === 'in_service' || value === 'allocated_only') {
        onNodeFilterChange(value);
      }
    },
    [onNodeFilterChange]
  );

  const resolveSiteNodeOverlaps = useCallback(
    (nds: Node<SandFlowNodeData | SandLegLabelNodeData | SandPlannedLegLabelNodeData>[], movedNodeId?: string) => {
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
      <EdgeLabelModeContext.Provider value={edgeLabelMode}>
      <div className="flow-schematic-stage">
        <div
          ref={canvasRef}
          className="flow-schematic-canvas w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] h-[min(58vh,520px)]"
        >
          <ReactFlow
            className="w-full h-full"
            nodes={nodes}
            edges={edges}
            defaultViewport={viewport}
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
            minZoom={0.12}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
          >
            <SandFlowViewportSync viewport={viewport} />
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
            <span className="flow-schematic-edit-panel-label">Объекты на схеме</span>
            <AppSelect
              variant="sm"
              fullWidth
              ariaLabel="Фильтр объектов на схеме"
              options={SAND_LOGISTICS_NODE_FILTER_OPTIONS}
              value={nodeFilter}
              onChange={handleNodeFilterChange}
            />
            <p className="flow-schematic-edit-panel-hint">
              «Только введённые» — срез на дату расчёта; «С отгрузкой» — без нулевых плеч.
            </p>
          </div>
          <div className="flow-schematic-edit-panel-section">
            <span className="flow-schematic-edit-panel-label">Плановые плечи</span>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={showPlannedRoutes}
                onChange={(e) => onShowPlannedRoutesChange(e.target.checked)}
              />
              Показать маршруты к будущим объектам
            </label>
          </div>
          <div className="flow-schematic-edit-panel-section">
            <span className="flow-schematic-edit-panel-label">Год ввода</span>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={groupByEntryYear}
                onChange={(e) => onGroupByEntryYearChange(e.target.checked)}
              />
              Сдвиг по году ввода
            </label>
            <p className="flow-schematic-edit-panel-hint">
              Лёгкий сдвиг блоков по оси Y для объектов одного года ввода.
            </p>
          </div>
          <div className="flow-schematic-edit-panel-section">
            <span className="flow-schematic-edit-panel-label">Подписи объёма</span>
            <AppSelect
              variant="sm"
              fullWidth
              ariaLabel="Подписи объёма на схеме"
              options={SAND_LOGISTICS_EDGE_LABEL_MODE_OPTIONS}
              value={edgeLabelMode}
              onChange={handleEdgeLabelModeChange}
            />
            <p className="flow-schematic-edit-panel-hint">
              «Ключевые» — одна подпись на плечо карьер → потребитель; «Все сегменты» — как раньше
              на каждом отрезке дороги.
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
      </EdgeLabelModeContext.Provider>
    </LineStyleContext.Provider>
  );
});

function SandSchematicLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">
      <span>
        <span className="inline-block w-3 h-3 rounded border-2 border-dashed border-slate-400 align-middle mr-1" />
        будущий ввод
      </span>
      <span className="text-green-700 font-medium">зелёный — спрос покрыт</span>
      <span className="text-amber-700 font-medium">жёлтый — частично</span>
      <span className="text-orange-700 font-medium">оранжевый — нет отгрузки</span>
      <span>
        <span className="inline-block w-4 border-t-2 border-orange-600 align-middle mr-1" />
        активный поток
      </span>
      <span>
        <span
          className="inline-block w-4 border-t-2 border-dashed border-slate-500 align-middle mr-1"
          style={{ borderTopStyle: 'dashed' }}
        />
        плановое плечо
      </span>
    </div>
  );
}

function EntryYearLegend({ years }: { years: number[] }) {
  if (years.length < 2) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
      <span>Годы ввода:</span>
      {years.map((year, i) => (
        <span key={year} className="inline-flex items-center gap-1">
          <span
            className="inline-block w-1 h-3 rounded-sm"
            style={{ background: ENTRY_YEAR_LANE_COLORS[i % ENTRY_YEAR_LANE_COLORS.length] }}
          />
          {year}
        </span>
      ))}
    </div>
  );
}

function SandLogisticsFlowSchematicInner({
  layoutSubnet,
  sliceSubnet,
  asOf,
  horizonFrom,
  horizonTo,
  viewAsOf,
  onViewAsOfChange,
}: {
  layoutSubnet: SandLogisticsSubnet;
  sliceSubnet: SandLogisticsSubnet;
  asOf?: string;
  horizonFrom?: string;
  horizonTo?: string;
  viewAsOf?: string;
  onViewAsOfChange?: (next: string) => void;
}) {
  const { projectId } = useFlowSchematicContext();
  const isMobile = useIsMobile();
  const timelineViewActive = Boolean(horizonFrom && horizonTo && viewAsOf && onViewAsOfChange);
  const topologyKey = useMemo(
    () => computeSandLogisticsTopologyKey(layoutSubnet),
    [layoutSubnet],
  );
  const sliceKey = useMemo(
    () => computeSandLogisticsSliceKey(sliceSubnet, asOf),
    [sliceSubnet, asOf],
  );
  const [lineStyle, setLineStyle] = useState<SandLogisticsLineStyle>(() =>
    projectId ? loadSandLogisticsLineStyle(projectId) : 'straight'
  );
  const [edgeLabelMode, setEdgeLabelMode] = useState<SandLogisticsEdgeLabelMode>(() =>
    projectId ? loadSandLogisticsEdgeLabelMode(projectId) : 'key'
  );
  const [nodeFilter, setNodeFilter] = useState<SandLogisticsNodeFilterMode>(() =>
    projectId ? loadSandLogisticsNodeFilterMode(projectId) : 'all_planned'
  );
  const [showPlannedRoutes, setShowPlannedRoutes] = useState(() =>
    projectId ? loadSandLogisticsShowPlannedRoutes(projectId) : true
  );
  const [groupByEntryYear, setGroupByEntryYear] = useState(() =>
    projectId ? loadSandLogisticsGroupByEntryYear(projectId) : false
  );

  useEffect(() => {
    if (!projectId) return;
    setLineStyle(loadSandLogisticsLineStyle(projectId));
    setEdgeLabelMode(loadSandLogisticsEdgeLabelMode(projectId));
    setNodeFilter(loadSandLogisticsNodeFilterMode(projectId));
    setShowPlannedRoutes(loadSandLogisticsShowPlannedRoutes(projectId));
    setGroupByEntryYear(loadSandLogisticsGroupByEntryYear(projectId));
  }, [projectId]);

  const flowNodeFilter = timelineViewActive ? 'all_planned' : nodeFilter;

  const layout = useMemo(
    () =>
      buildSandLogisticsLayout(layoutSubnet, {
        nodeFilter: flowNodeFilter,
        groupByEntryYear,
      }),
    [layoutSubnet, topologyKey, flowNodeFilter, groupByEntryYear],
  );

  const built = useMemo(() => {
    try {
      return buildSandLogisticsSliceFlow(layout, sliceSubnet, {
        edgeLabelMode,
        nodeFilter: flowNodeFilter,
        showPlannedRoutes,
        as_of: asOf,
      });
    } catch (error) {
      console.error('buildSandLogisticsSliceFlow failed', error);
      throw error;
    }
  }, [
    layout,
    sliceSubnet,
    sliceKey,
    edgeLabelMode,
    flowNodeFilter,
    showPlannedRoutes,
    asOf,
  ]);
  const {
    summary,
    nodes: initialNodes,
    edges: initialEdges,
    entryYears,
    siteNodeIds,
    defaultViewport,
  } = built;

  const layoutKey = useMemo(
    () =>
      [
        topologyKey,
        flowNodeFilter,
        edgeLabelMode,
        showPlannedRoutes ? '1' : '0',
        groupByEntryYear ? '1' : '0',
      ].join('|'),
    [topologyKey, flowNodeFilter, edgeLabelMode, showPlannedRoutes, groupByEntryYear],
  );

  const handleLineStyleChange = useCallback(
    (style: SandLogisticsLineStyle) => {
      setLineStyle(style);
      if (projectId) saveSandLogisticsLineStyle(projectId, style);
    },
    [projectId]
  );

  const handleEdgeLabelModeChange = useCallback(
    (mode: SandLogisticsEdgeLabelMode) => {
      setEdgeLabelMode(mode);
      if (projectId) saveSandLogisticsEdgeLabelMode(projectId, mode);
    },
    [projectId]
  );

  const handleNodeFilterChange = useCallback(
    (mode: SandLogisticsNodeFilterMode) => {
      setNodeFilter(mode);
      if (projectId) saveSandLogisticsNodeFilterMode(projectId, mode);
    },
    [projectId]
  );

  const handleShowPlannedRoutesChange = useCallback(
    (value: boolean) => {
      setShowPlannedRoutes(value);
      if (projectId) saveSandLogisticsShowPlannedRoutes(projectId, value);
    },
    [projectId]
  );

  const handleGroupByEntryYearChange = useCallback(
    (value: boolean) => {
      setGroupByEntryYear(value);
      if (projectId) saveSandLogisticsGroupByEntryYear(projectId, value);
    },
    [projectId]
  );

  if (
    layoutSubnet.quarries.length === 0 &&
    layoutSubnet.consumers.length === 0 &&
    (layoutSubnet.network_nodes?.length ?? 0) === 0
  ) {
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
      {asOf && !(horizonFrom && horizonTo && viewAsOf && onViewAsOfChange) && (
        <p className="text-sm font-medium">
          Срез на {formatEntryDateRu(asOf)} · жадное распределение (накопительно)
        </p>
      )}
      {horizonFrom && horizonTo && viewAsOf && onViewAsOfChange && (
        <SandLogisticsSchematicTimeline
          subnet={layoutSubnet}
          horizonFrom={horizonFrom}
          horizonTo={horizonTo}
          viewAsOf={viewAsOf}
          onViewAsOfChange={onViewAsOfChange}
        />
      )}
      <SandSchematicLegend />
      {groupByEntryYear && <EntryYearLegend years={entryYears} />}

      <SandLogisticsFlowCanvas
        key={layoutKey}
        initialNodes={initialNodes}
        initialEdges={initialEdges}
        siteNodeIds={siteNodeIds}
        defaultViewport={defaultViewport}
        isMobile={isMobile}
        lineStyle={lineStyle}
        edgeLabelMode={edgeLabelMode}
        nodeFilter={nodeFilter}
        showPlannedRoutes={showPlannedRoutes}
        groupByEntryYear={groupByEntryYear}
        onLineStyleChange={handleLineStyleChange}
        onEdgeLabelModeChange={handleEdgeLabelModeChange}
        onNodeFilterChange={handleNodeFilterChange}
        onShowPlannedRoutesChange={handleShowPlannedRoutesChange}
        onGroupByEntryYearChange={handleGroupByEntryYearChange}
      />
    </div>
  );
}

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
