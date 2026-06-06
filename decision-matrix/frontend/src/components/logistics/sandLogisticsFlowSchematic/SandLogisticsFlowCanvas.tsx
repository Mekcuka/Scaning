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
import { FlowSchematicEditPanel } from '../../FlowSchematicEditPanel';
import {
  applySandFlowSitePositions,
  computeSandFlowDefaultViewport,
  mergeSliceFlowNodes,
} from '../../../lib/sandLogisticsFlow';
import { EdgeLabelModeContext, LineStyleContext } from './context';
import { edgeTypes } from './edgeComponents';
import type { FlowCanvasProps } from './flowCanvasTypes';
import { SandLogisticsDisplayOptions } from './SandLogisticsDisplayOptions';
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

  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type !== 'sandFlowNode') return;
      setNodes((nds) =>
        applySandFlowSitePositions(nds, { movedNodeId: node.id, siteCount: siteNodeIds.length }),
      );
    },
    [setNodes, siteNodeIds.length],
  );

  return (
    <LineStyleContext.Provider value={lineStyle}>
      <EdgeLabelModeContext.Provider value={edgeLabelMode}>
      <div className="flow-schematic-stage sand-logistics-flow-stage">
        <div
          ref={canvasRef}
          className="flow-schematic-canvas sand-logistics-flow-canvas w-full rounded-lg border border-[var(--border)] bg-[var(--bg)]"
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
          title="Настройки"
          ariaLabel="Настройки схемы движения песка"
        >
          <SandLogisticsDisplayOptions
            lineStyle={lineStyle}
            edgeLabelMode={edgeLabelMode}
            nodeFilter={nodeFilter}
            showPlannedRoutes={showPlannedRoutes}
            groupByEntryYear={groupByEntryYear}
            onLineStyleChange={handleLineStyleChange}
            onEdgeLabelModeChange={handleEdgeLabelModeChange}
            onNodeFilterChange={handleNodeFilterChange}
            onShowPlannedRoutesChange={onShowPlannedRoutesChange}
            onGroupByEntryYearChange={onGroupByEntryYearChange}
            onResetLayout={resetLayout}
          />
        </FlowSchematicEditPanel>
      </div>
      </EdgeLabelModeContext.Provider>
    </LineStyleContext.Provider>
  );
});
