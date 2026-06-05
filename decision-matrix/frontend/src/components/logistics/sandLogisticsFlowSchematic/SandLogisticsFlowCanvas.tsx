import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  Background,
  Controls,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { LayoutGrid, MousePointer2 } from 'lucide-react';
import { AppSelect } from '../../AppSelect';
import { FlowSchematicEditPanel } from '../../FlowSchematicEditPanel';
import {
  computeSandFlowDefaultViewport,
  enforceSandFlowSitesNoOverlap,
  mergeSliceFlowNodes,
  SAND_FLOW_SITE_GAP,
  SAND_FLOW_SITE_H,
  SAND_FLOW_SITE_W,
  SAND_LOGISTICS_EDGE_LABEL_MODE_OPTIONS,
  SAND_LOGISTICS_LINE_STYLE_OPTIONS,
  SAND_LOGISTICS_NODE_FILTER_OPTIONS,
  type SandFlowNodeData,
  type SandLegLabelNodeData,
  type SandPlannedLegLabelNodeData,
} from '../../../lib/sandLogisticsFlow';
import { EdgeLabelModeContext, LineStyleContext } from './context';
import { edgeTypes } from './edgeComponents';
import type { FlowCanvasProps } from './flowCanvasTypes';
import { nodeTypes } from './nodeComponents';
import { SandFlowViewportSync } from './SandFlowViewportSync';
import { stampSandFlowLineStyle } from './stampSandFlowLineStyle';

export const SandLogisticsFlowCanvas = memo(function SandLogisticsFlowCanvas({
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
