import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type Connection,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  MousePointer2,
  Link2,
  Plus,
  Trash2,
  LayoutGrid,
  Save,
  RotateCcw,
  Pencil,
  Eye,
} from 'lucide-react';
import type { FlowEditorTool, FlowNodeData, FlowSchematicDto, FluidKind } from '../lib/flowSchematic';
import {
  ADD_NODE_TEMPLATES,
  DEFAULT_SEPARATION_PERCENT,
  FLUID_COLORS,
  FLUID_LABELS,
  edgeFromDto,
  flowToSchematicDto,
  capacityUnitLabel,
  kindStyle,
  layoutWithDagre,
  newEdgeId,
  newNodeId,
  formatCapacity,
  formatEdgeFlow,
  nodeHasThroughputCapacity,
  nodePersistsThroughputCapacity,
  parseCapacityInput,
  resolveCapacityUnit,
  schematicToFlow,
} from '../lib/flowSchematic';
import type { PoiFlowContext } from '../lib/flowPropagation';
import { propagateFlows } from '../lib/flowPropagation';
import {
  FlowPropagationContext,
  FlowEdgePropagationContext,
  FlowPoiContext,
  FlowSchematicActionsContext,
  useFlowPoi,
  useFlowPropagation,
  useFlowEdgePropagation,
  useFlowSchematicActions,
} from '../lib/flowSchematicContext';
import { useIsMobile } from '../hooks/useMediaQuery';
import type { POI } from '../lib/api';
import { DeferredNumberInput } from './DeferredNumberInput';

function capacityValuesEqual(
  a: number | null | undefined,
  b: number | null | undefined
): boolean {
  const left = a ?? null;
  const right = b ?? null;
  if (left === null && right === null) return true;
  if (left === null || right === null) return false;
  return Math.abs(left - right) < 1e-9;
}

function FlowCapacityPopover({
  nodeId,
  data,
  flowAnnual,
  flowUnit,
  overCapacity,
  open,
  onOpenChange,
}: {
  nodeId: string;
  data: FlowNodeData;
  flowAnnual: number | null;
  flowUnit: string | null;
  overCapacity: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const actions = useFlowSchematicActions();
  const poiCtx = useFlowPoi();
  const isPoiNode = data.kind === 'poi';
  const unit = isPoiNode
    ? poiCtx?.fluid_type === 'gas'
      ? 'thousand_m3_per_year'
      : 'thousand_t_per_year'
    : resolveCapacityUnit(data);
  const unitLabel = capacityUnitLabel(unit);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const productionValue = poiCtx?.planned_production_volume ?? null;
  const capacitySource = isPoiNode ? productionValue : data.throughput_capacity_annual;

  useEffect(() => {
    if (open) {
      setDraft(capacitySource != null ? String(capacitySource) : '');
    }
  }, [open, capacitySource]);

  const commit = useCallback(() => {
    if (!actions) return true;
    const nextVal = draft.trim() === '' ? null : parseCapacityInput(draft);
    if (draft.trim() !== '' && nextVal === null) {
      inputRef.current?.focus();
      return false;
    }
    const currentVal = capacitySource ?? null;
    if (capacityValuesEqual(nextVal, currentVal)) return true;
    if (isPoiNode) {
      if (nextVal != null) actions.onPoiProductionChange(nextVal);
      return true;
    }
    actions.onCapacityChange(nodeId, nextVal, nextVal != null ? unit : data.capacity_unit ?? unit);
    return true;
  }, [actions, draft, nodeId, unit, data.capacity_unit, isPoiNode, capacitySource]);

  const showCapacity = nodeHasThroughputCapacity(data.kind);
  const isWaterFormation =
    data.kind === 'utilization' && data.fluid === 'water' && data.label === 'В пласт';

  if (!open) return null;

  return (
    <div
      className="flow-capacity-popover absolute z-50 left-1/2 -translate-x-1/2 bottom-full mb-1 w-[240px] rounded-lg border border-[var(--border)] bg-white text-[#0f1c2e] px-3 py-2.5 pb-3 text-xs shadow-lg"
      onMouseEnter={() => onOpenChange(true)}
      role="dialog"
      aria-label={showCapacity ? 'Пропускная способность' : 'Поток фазы'}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="font-semibold mb-2">
        {showCapacity ? (isPoiNode ? 'Плановый дебит' : 'Пропускная способность') : data.label}
      </div>
      {isWaterFormation && (
        <div className="text-slate-500 mb-2">
          Объём закачки:{' '}
          <span className="text-[#0f1c2e]">
            {poiCtx && poiCtx.water_injection_volume > 0
              ? formatCapacity(poiCtx.water_injection_volume, 'thousand_t_per_year')
              : 'не задан'}
          </span>
        </div>
      )}
      {flowAnnual != null && !isWaterFormation && (
        <div className="text-slate-500 mb-2">
          Поток: <span className="text-[#0f1c2e]">{formatCapacity(flowAnnual, flowUnit)}</span>
          {showCapacity && overCapacity && (
            <span className="block text-red-600 font-medium mt-0.5">Поток превышает пропускную способность</span>
          )}
        </div>
      )}
      {data.kind === 'poi' && poiCtx?.fluid_type === 'oil' && (
        <div className="text-slate-500 mb-2">
          Газовый фактор:{' '}
          <span className="text-[#0f1c2e]">{poiCtx.gas_factor ?? 120} м³/т</span>
        </div>
      )}
      {!showCapacity && !isWaterFormation && (
        <p className="text-[10px] text-slate-500">Фазовая ветка — лимит задаётся на оборудовании ниже по цепочке.</p>
      )}
      {showCapacity && (
        <div className="flow-capacity-editor">
          <label className="flow-capacity-field">
            <input
              ref={inputRef}
              type="text"
              inputMode="decimal"
              className="flow-capacity-input"
              placeholder="—"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => commit()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (commit()) onOpenChange(false);
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  onOpenChange(false);
                }
              }}
            />
            <span className="flow-capacity-unit">{unitLabel}</span>
          </label>
          <p className="text-[10px] text-slate-500 mt-1.5">
            {isPoiNode ? 'Сохраняется в параметрах точки интереса' : 'Сохраняется в схему автоматически'}
          </p>
        </div>
      )}
      <button
        type="button"
        className="absolute top-1 right-1 text-slate-400 hover:text-slate-700 leading-none px-1"
        aria-label="Закрыть"
        onClick={() => {
          commit();
          onOpenChange(false);
        }}
      >
        ×
      </button>
      <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-white drop-shadow-[0_1px_0_var(--border)]" />
    </div>
  );
}

function FlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
}: EdgeProps) {
  const edgeFlowMap = useFlowEdgePropagation();
  const fs = edgeFlowMap.get(id);
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });
  const showLabel = fs?.flowAnnual != null && fs.flowAnnual > 0;

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />
      {showLabel && (
        <EdgeLabelRenderer>
          <div
            className="flow-edge-label nodrag nopan"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              borderColor: (style?.stroke as string) ?? 'var(--border)',
              color: (style?.stroke as string) ?? 'var(--text)',
            }}
            title={formatCapacity(fs.flowAnnual, fs.flowUnit)}
          >
            {formatEdgeFlow(fs.flowAnnual!, fs.flowUnit)}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

function FlowNode({ id, data, selected }: NodeProps<Node<FlowNodeData>>) {
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
          isSeparator ? 'min-w-[130px]' : 'min-w-[120px] max-w-[220px]'
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
              value={separationPercent}
              integer
              min={1}
              max={100}
              className="w-11 px-1 py-0.5 rounded border border-slate-300 text-center text-[10px] bg-white text-[#0f1c2e]"
              title="Процент сепарации нефти от дебита жидкости"
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

const nodeTypes = { flowNode: FlowNode };
const edgeTypes = { flowEdge: FlowEdge };

type FlowSchematicEditorProps = {
  schematic: FlowSchematicDto;
  poi: POI | null;
  onSave: (dto: FlowSchematicDto) => void;
  onPersistCapacity?: (dto: FlowSchematicDto) => void;
  onPlannedProductionChange?: (volume: number) => void;
  onReset: () => void;
  saving?: boolean;
  resetting?: boolean;
  /** Tailwind height class for the canvas, e.g. h-[min(40vh,400px)] */
  canvasHeightClass?: string;
};

function poiFlowContext(poi: POI | null): PoiFlowContext | null {
  if (!poi) return null;
  return {
    fluid_type: poi.fluid_type,
    planned_production_volume: poi.planned_production_volume ?? 0,
    water_injection_volume: poi.water_injection_volume ?? 0,
    gas_factor: poi.gas_factor ?? 120,
  };
}

function nodesToDto(nodes: Node<FlowNodeData>[]): FlowSchematicDto['nodes'] {
  return nodes.map((n) => {
    const d = n.data;
    return {
      id: n.id,
      kind: d.kind,
      label: d.label,
      fluid: (d.fluid ?? null) as FlowSchematicDto['nodes'][0]['fluid'],
      subtype: d.subtype ?? null,
      status: null,
      position_x: n.position.x,
      position_y: n.position.y,
      throughput_capacity_annual: nodePersistsThroughputCapacity(d.kind)
        ? d.throughput_capacity_annual ?? null
        : null,
      capacity_unit: nodePersistsThroughputCapacity(d.kind) ? d.capacity_unit ?? null : null,
      separation_percent: d.kind === 'separator' ? (d.separation_percent ?? DEFAULT_SEPARATION_PERCENT) : null,
    };
  });
}

function FlowSchematicEditorInner({
  schematic,
  poi,
  onSave,
  onPersistCapacity,
  onPlannedProductionChange,
  onReset,
  saving,
  resetting,
  canvasHeightClass = 'h-[min(70vh,560px)]',
}: FlowSchematicEditorProps) {
  const isMobile = useIsMobile();
  const [mobileEdit, setMobileEdit] = useState(false);
  const readOnly = isMobile && !mobileEdit;
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
      {readOnly ? (
        <div className="flow-mobile-view-banner">
          <Eye size={16} className="shrink-0 text-[var(--accent)]" aria-hidden />
          <span className="flex-1 min-w-0">
            Режим просмотра на телефоне. Для редактирования схемы используйте компьютер или включите
            редактирование.
          </span>
          <button type="button" className="btn btn-secondary btn-sm shrink-0" onClick={() => setMobileEdit(true)}>
            <Pencil size={14} className="inline mr-1" />
            Редактировать
          </button>
        </div>
      ) : isMobile ? (
        <div className="flow-mobile-view-banner">
          <Pencil size={16} className="shrink-0 text-[var(--primary)]" aria-hidden />
          <span className="flex-1 min-w-0">Режим редактирования на телефоне — упрощённая панель инструментов.</span>
          <button type="button" className="btn btn-ghost btn-sm shrink-0" onClick={() => setMobileEdit(false)}>
            <Eye size={14} className="inline mr-1" />
            Только просмотр
          </button>
        </div>
      ) : null}

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
                <aside className="flow-schematic-edit-panel" aria-label="Редактирование схемы">
                  <div className="flow-schematic-edit-panel-head">
                    <h3 className="flow-schematic-edit-panel-title">Редактирование</h3>
                  </div>

                  <div className="flow-schematic-edit-panel-section">
                    <span className="flow-schematic-edit-panel-label">Инструмент</span>
                    <button
                      type="button"
                      className={`btn btn-sm w-full justify-start ${tool === 'select' ? 'btn-primary' : 'btn-ghost'}`}
                      title="Выбор и перемещение"
                      onClick={() => setTool('select')}
                    >
                      <MousePointer2 size={16} />
                      Выбор
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm w-full justify-start ${tool === 'connect' ? 'btn-primary' : 'btn-ghost'}`}
                      title="Соединить блоки"
                      onClick={() => setTool('connect')}
                    >
                      <Link2 size={16} />
                      Связь
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm w-full justify-start ${tool === 'add' ? 'btn-primary' : 'btn-ghost'}`}
                      title="Клик по полю — добавить блок"
                      onClick={() => setTool('add')}
                    >
                      <Plus size={16} />
                      Блок
                    </button>
                  </div>

                  {tool === 'connect' && (
                    <div className="flow-schematic-edit-panel-section">
                      <span className="flow-schematic-edit-panel-label">Флюид связи</span>
                      <AppSelectFluid value={connectFluid} onChange={setConnectFluid} />
                    </div>
                  )}

                  {tool === 'add' && (
                    <div className="flow-schematic-edit-panel-section">
                      <span className="flow-schematic-edit-panel-label">Тип блока</span>
                      <select
                        className="input text-sm py-1.5 px-2 w-full"
                        value={addTemplateIndex}
                        onChange={(e) => setAddTemplateIndex(Number(e.target.value))}
                      >
                        {ADD_NODE_TEMPLATES.map((t, i) => (
                          <option key={`${t.kind}-${t.label}-${i}`} value={i}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="flow-schematic-edit-panel-section">
                    <span className="flow-schematic-edit-panel-label">Действия</span>
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost w-full justify-start"
                      onClick={editSelectedLabel}
                      title="Переименовать"
                    >
                      Подпись…
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost w-full justify-start"
                      onClick={autoLayout}
                      title="Авто-раскладка"
                    >
                      <LayoutGrid size={16} />
                      Раскладка
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost w-full justify-start"
                      onClick={deleteSelected}
                      title="Удалить выбранное"
                    >
                      <Trash2 size={16} />
                      Удалить
                    </button>
                  </div>

                  <div className="flow-schematic-edit-panel-section">
                    <span className="flow-schematic-edit-panel-label">Схема</span>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary w-full justify-start"
                      onClick={handleSave}
                      disabled={saving}
                    >
                      <Save size={16} />
                      {saving ? 'Сохранение…' : 'Сохранить'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost w-full justify-start"
                      onClick={onReset}
                      disabled={resetting || saving}
                      title={
                        isCustom
                          ? 'Удалить пользовательскую схему и пересчитать по POI и сети'
                          : 'Пересчитать схему по текущим параметрам POI и сети'
                      }
                    >
                      <RotateCcw size={16} />
                      {resetting ? 'Пересчёт…' : isCustom ? 'Сброс' : 'Пересчитать'}
                    </button>
                  </div>

                  <p className="flow-schematic-edit-panel-hint">
                    Перетаскивание по полю — перемещение схемы. Shift + перетаскивание — выделение рамкой.
                    Двойной клик — переименование. Delete — удалить выделенное.
                  </p>
                </aside>
              )}
            </div>
          </FlowSchematicActionsContext.Provider>
        </FlowPoiContext.Provider>
        </FlowEdgePropagationContext.Provider>
      </FlowPropagationContext.Provider>
    </div>
  );
}

function AppSelectFluid({
  value,
  onChange,
}: {
  value: FluidKind;
  onChange: (f: FluidKind) => void;
}) {
  return (
    <select
      className="input text-sm py-1.5 px-2 w-full"
      value={value}
      onChange={(e) => onChange(e.target.value as FluidKind)}
      title="Тип флюида для новой связи"
    >
      {(['oil', 'water', 'gas'] as const).map((f) => (
        <option key={f} value={f}>
          {FLUID_LABELS[f]}
        </option>
      ))}
    </select>
  );
}

export function FlowSchematicEditor(props: FlowSchematicEditorProps) {
  return (
    <ReactFlowProvider>
      <FlowSchematicEditorInner {...props} />
    </ReactFlowProvider>
  );
}
