import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { FlowEditorTool, FlowNodeData, FluidKind } from '../../lib/flowSchematic';
import {
  ADD_NODE_TEMPLATES,
  DEFAULT_SEPARATION_PERCENT,
  edgeFromDto,
  flowToSchematicDto,
  layoutWithDagre,
  newEdgeId,
  newNodeId,
  schematicToFlow,
} from '../../lib/flowSchematic';
import { propagateFlows } from '../../lib/flowPropagation';
import {
  FlowPropagationContext,
  FlowEdgePropagationContext,
  FlowPoiContext,
  FlowSchematicActionsContext,
} from '../../lib/flowSchematicContext';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { capacityValuesEqual, nodesToDto, poiFlowContext } from './helpers';
import { edgeTypes, nodeTypes } from './flowTypes';
import { FlowSchematicMobileBanner } from './FlowSchematicMobileBanner';
import { FlowSchematicEditorPanel } from './FlowSchematicEditorPanel';
import type { FlowSchematicEditorProps } from './types';

export function FlowSchematicEditorInner({
  schematic,
  poi,
  onSave,
  onPersistCapacity,
  onPlannedProductionChange,
  onReset,
  saving,
  resetting,
  forceReadOnly = false,
  canvasHeightClass = 'h-[min(70vh,560px)]',
}: FlowSchematicEditorProps) {
  const isMobile = useIsMobile();
  const [mobileEdit, setMobileEdit] = useState(false);
  const readOnly = forceReadOnly || (isMobile && !mobileEdit);
  const { screenToFlowPosition } = useReactFlow();
  const initial = useMemo(() => schematicToFlow(schematic), [schematic]);
  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);
  const [tool, setTool] = useState<FlowEditorTool>('select');
  const [connectFluid, setConnectFluid] = useState<FluidKind>('oil');
  const [addTemplateIndex, setAddTemplateIndex] = useState(0);
  const syncKey = useMemo(
    () =>
      JSON.stringify({
        poi_id: schematic.poi_id,
        source: schematic.source,
        nodes: schematic.nodes,
        edges: schematic.edges,
      }),
    [schematic]
  );

  useEffect(() => {
    const next = schematicToFlow(schematic);
    setNodes(next.nodes);
    setEdges(next.edges);
  }, [syncKey, schematic, setNodes, setEdges]);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      const edge: Edge = edgeFromDto({
        id: newEdgeId(),
        source: connection.source,
        target: connection.target,
        fluid: connectFluid,
      });
      setEdges((eds) => [...eds, edge]);
    },
    [connectFluid, setEdges]
  );

  const onPaneClick = useCallback(
    (event: ReactMouseEvent) => {
      if (tool !== 'add') return;
      const template = ADD_NODE_TEMPLATES[addTemplateIndex] ?? ADD_NODE_TEMPLATES[0];
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const node: Node<FlowNodeData> = {
        id: newNodeId(),
        type: 'flowNode',
        position,
        data: {
          label: template.label,
          kind: template.kind,
          fluid: template.fluid,
          ...(template.kind === 'separator' ? { separation_percent: DEFAULT_SEPARATION_PERCENT } : {}),
        },
      };
      setNodes((nds) => [...nds, node]);
    },
    [tool, addTemplateIndex, screenToFlowPosition, setNodes]
  );

  const deleteSelected = useCallback(() => {
    setNodes((nds) => {
      const removed = new Set(nds.filter((n) => n.selected).map((n) => n.id));
      setEdges((eds) =>
        eds.filter(
          (e) => !e.selected && !removed.has(e.source) && !removed.has(e.target)
        )
      );
      return nds.filter((n) => !n.selected);
    });
  }, [setNodes, setEdges]);

  const autoLayout = useCallback(() => {
    setNodes((nds) => layoutWithDagre(nds, edges));
  }, [edges, setNodes]);

  const renameNode = useCallback(
    (node: Node<FlowNodeData>) => {
      const next = window.prompt('Название блока', node.data.label);
      if (next == null || !next.trim()) return;
      setNodes((nds) =>
        nds.map((n) =>
          n.id === node.id ? { ...n, data: { ...n.data, label: next.trim() } } : n
        )
      );
    },
    [setNodes]
  );

  const editSelectedLabel = useCallback(() => {
    const selected = nodes.find((n) => n.selected);
    if (selected) renameNode(selected as Node<FlowNodeData>);
  }, [nodes, renameNode]);

  const handleSave = useCallback(() => {
    onSave(flowToSchematicDto(schematic.poi_id, nodes, edges, schematic.warnings));
  }, [onSave, schematic.poi_id, schematic.warnings, nodes, edges]);

  const poiCtx = poiFlowContext(poi);

  const { nodes: flowMap, edges: edgeFlowMap } = useMemo(() => {
    if (!poiCtx) return { nodes: new Map(), edges: new Map() };
    const dtoEdges = edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      fluid: ((e.data as { fluid?: string })?.fluid ?? 'oil') as string,
    }));
    return propagateFlows(nodesToDto(nodes as Node<FlowNodeData>[]), dtoEdges, poiCtx);
  }, [nodes, edges, poiCtx]);

  const onCapacityChange = useCallback(
    (nodeId: string, value: number | null, unit: string) => {
      setNodes((nds) => {
        const current = nds.find((n) => n.id === nodeId)?.data.throughput_capacity_annual;
        if (capacityValuesEqual(value, typeof current === 'number' ? current : null)) return nds;
        const updated = nds.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                data: {
                  ...n.data,
                  throughput_capacity_annual: value,
                  capacity_unit: value != null ? unit : n.data.capacity_unit,
                },
              }
            : n
        );
        if (onPersistCapacity) {
          onPersistCapacity(
            flowToSchematicDto(schematic.poi_id, updated, edges, schematic.warnings)
          );
        }
        return updated;
      });
    },
    [setNodes, edges, schematic.poi_id, schematic.warnings, onPersistCapacity]
  );

  const onSeparationPercentChange = useCallback(
    (nodeId: string, value: number) => {
      setNodes((nds) => {
        const current = nds.find((n) => n.id === nodeId)?.data.separation_percent;
        const currentNum = typeof current === 'number' ? current : DEFAULT_SEPARATION_PERCENT;
        if (capacityValuesEqual(value, currentNum)) return nds;
        return nds.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, separation_percent: value } } : n
        );
      });
    },
    [setNodes]
  );

  const onPoiProductionChange = useCallback(
    (volume: number) => {
      if (capacityValuesEqual(volume, poi?.planned_production_volume)) return;
      onPlannedProductionChange?.(volume);
    },
    [onPlannedProductionChange, poi?.planned_production_volume]
  );

  const schematicActions = useMemo(
    () => ({ onCapacityChange, onSeparationPercentChange, onPoiProductionChange }),
    [onCapacityChange, onSeparationPercentChange, onPoiProductionChange]
  );

  const isCustom = schematic.source === 'custom';
  const overloadCount = [...flowMap.values()].filter((f) => f.overCapacity).length;

  useEffect(() => {
    if (readOnly) setTool('select');
  }, [readOnly]);

  return (
    <div className="flex flex-col gap-3">
      <FlowSchematicMobileBanner
        readOnly={readOnly}
        isMobile={isMobile}
        onEnableEdit={() => setMobileEdit(true)}
        onDisableEdit={() => setMobileEdit(false)}
      />

      {overloadCount > 0 && (
        <p className="text-xs text-red-600 font-medium">
          Перегрузка: {overloadCount} блок(ов) — пропускная способность ниже входящего потока.
        </p>
      )}

      <FlowPropagationContext.Provider value={flowMap}>
        <FlowEdgePropagationContext.Provider value={edgeFlowMap}>
        <FlowPoiContext.Provider
          value={
            poi
              ? {
                  fluid_type: poi.fluid_type,
                  planned_production_volume: poi.planned_production_volume ?? 0,
                  water_injection_volume: poi.water_injection_volume ?? 0,
                  gas_factor: poi.gas_factor ?? 120,
                  eng_injection: poi.eng_injection,
                }
              : null
          }
        >
          <FlowSchematicActionsContext.Provider value={schematicActions}>
            <div className="flow-schematic-stage">
              <div
                className={`flow-schematic-canvas w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] ${canvasHeightClass}`}
              >
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnect={onConnect}
                  onPaneClick={onPaneClick}
                  onNodeDoubleClick={(_e, node) => renameNode(node as Node<FlowNodeData>)}
                  nodeTypes={nodeTypes}
                  edgeTypes={edgeTypes}
                  defaultEdgeOptions={{ type: 'flowEdge' }}
                  fitView
                  fitViewOptions={{ padding: 0.2 }}
                  nodesDraggable={!readOnly && tool === 'select'}
                  nodesConnectable={!readOnly && tool === 'connect'}
                  elementsSelectable={!readOnly}
                  deleteKeyCode={readOnly ? null : ['Backspace', 'Delete']}
                  panOnDrag
                  zoomOnPinch
                  zoomOnScroll={!isMobile}
                  selectionOnDrag={false}
                  selectionKeyCode="Shift"
                  proOptions={{ hideAttribution: true }}
                >
                  <Background gap={16} color="var(--border)" />
                  <Controls showInteractive={false} position="bottom-left" />
                </ReactFlow>
              </div>

              {!readOnly && (
                <FlowSchematicEditorPanel
                  tool={tool}
                  onToolChange={setTool}
                  connectFluid={connectFluid}
                  onConnectFluidChange={setConnectFluid}
                  addTemplateIndex={addTemplateIndex}
                  onAddTemplateIndexChange={setAddTemplateIndex}
                  onEditSelectedLabel={editSelectedLabel}
                  onAutoLayout={autoLayout}
                  onDeleteSelected={deleteSelected}
                  onSave={handleSave}
                  onReset={onReset}
                  saving={saving}
                  resetting={resetting}
                  isCustom={isCustom}
                />
              )}
            </div>
          </FlowSchematicActionsContext.Provider>
        </FlowPoiContext.Provider>
        </FlowEdgePropagationContext.Provider>
      </FlowPropagationContext.Provider>
    </div>
  );
}
