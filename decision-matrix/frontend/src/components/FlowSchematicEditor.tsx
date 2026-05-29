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
  type Connection,
  type Edge,
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
  nodeHasThroughputCapacity,
  parseCapacityInput,
  resolveCapacityUnit,
  schematicToFlow,
} from '../lib/flowSchematic';
import type { PoiFlowContext } from '../lib/flowPropagation';
import { propagateFlows } from '../lib/flowPropagation';
import {
  FlowPropagationContext,
  FlowPoiContext,
  FlowSchematicActionsContext,
  useFlowPoi,
  useFlowPropagation,
  useFlowSchematicActions,
} from '../lib/flowSchematicContext';
import { useIsMobile } from '../hooks/useMediaQuery';
import type { POI } from '../lib/api';

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
  const unit = resolveCapacityUnit(data);
  const unitLabel = capacityUnitLabel(unit);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setDraft(
        data.throughput_capacity_annual != null ? String(data.throughput_capacity_annual) : ''
      );
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open, data.throughput_capacity_annual]);

  const commit = useCallback(() => {
    if (!actions) return;
    const nextVal = parseCapacityInput(draft);
    if (draft.trim() !== '' && nextVal === null) {
      inputRef.current?.focus();
      return false;
    }
    actions.onCapacityChange(nodeId, nextVal, nextVal != null ? unit : data.capacity_unit ?? unit);
    return true;
  }, [actions, draft, nodeId, unit, data.capacity_unit]);

  const showCapacity = nodeHasThroughputCapacity(data.kind);
  const isWaterFormation =
    data.kind === 'utilization' && data.fluid === 'water' && data.label === 'В пласт';

  if (!open) return null;

  return (
    <div
      className="absolute z-50 left-1/2 -translate-x-1/2 bottom-full mb-1 w-[240px] rounded-lg border border-[var(--border)] bg-white text-[#0f1c2e] px-3 py-2.5 pb-3 text-left text-xs shadow-lg"
      onMouseEnter={() => onOpenChange(true)}
      role="dialog"
      aria-label={showCapacity ? 'Пропускная способность' : 'Поток фазы'}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="font-semibold mb-2">
        {showCapacity ? 'Пропускная способность' : data.label}
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
      {data.kind === 'poi' && data.flow_annual != null && (
        <div className="text-[10px] text-slate-500 mb-2">Исходный поток с куста</div>
      )}
      {!showCapacity && !isWaterFormation && (
        <p className="text-[10px] text-slate-500">Фазовая ветка — лимит задаётся на оборудовании ниже по цепочке.</p>
      )}
      {showCapacity && (
        <>
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="number"
              min={0}
              step="any"
              className="input text-xs py-1 px-2 flex-1 min-w-0"
              placeholder="—"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
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
            <span className="text-slate-500 whitespace-nowrap shrink-0">{unitLabel}</span>
          </div>
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              className="btn btn-sm btn-primary flex-1"
              onClick={() => {
                if (commit()) onOpenChange(false);
              }}
            >
              Применить
            </button>
          </div>
          <p className="text-[10px] text-slate-500 mt-1.5">Сохраняется в схему автоматически</p>
        </>
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

function FlowNode({ id, data, selected }: NodeProps<Node<FlowNodeData>>) {
  const flowMap = useFlowPropagation();
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
        className="flow-schematic-node px-3 py-2 rounded-lg text-sm shadow-sm min-w-[120px] max-w-[220px] text-center cursor-default"
        style={{
          background: bg,
          border: `2px solid ${accent}`,
          boxShadow: over ? '0 0 0 1px rgba(220, 38, 38, 0.35)' : undefined,
          outline: selected ? `2px solid var(--accent)` : undefined,
          outlineOffset: 2,
          color: 'var(--text)',
        }}
        onClick={(e) => {
          e.stopPropagation();
          clearCloseTimer();
          setPopoverOpen(true);
        }}
      >
        <Handle type="target" position={Position.Left} className="!bg-slate-400 !w-2.5 !h-2.5" />
        <div className="font-medium leading-tight break-words">{data.label}</div>
        <Handle type="source" position={Position.Right} className="!bg-slate-400 !w-2.5 !h-2.5" />
      </div>
    </div>
  );
}

const nodeTypes = { flowNode: FlowNode };

type FlowSchematicEditorProps = {
  schematic: FlowSchematicDto;
  poi: POI | null;
  onSave: (dto: FlowSchematicDto) => void;
  onPersistCapacity?: (dto: FlowSchematicDto) => void;
  onReset: () => void;
  saving?: boolean;
  resetting?: boolean;
};

function poiFlowContext(poi: POI | null): PoiFlowContext | null {
  if (!poi) return null;
  return {
    fluid_type: poi.fluid_type,
    planned_production_volume: poi.planned_production_volume ?? 0,
    water_injection_volume: poi.water_injection_volume ?? 0,
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
      throughput_capacity_annual: nodeHasThroughputCapacity(d.kind)
        ? d.throughput_capacity_annual ?? null
        : null,
      capacity_unit: nodeHasThroughputCapacity(d.kind) ? d.capacity_unit ?? null : null,
    };
  });
}

function FlowSchematicEditorInner({
  schematic,
  poi,
  onSave,
  onPersistCapacity,
  onReset,
  saving,
  resetting,
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

  const flowMap = useMemo(() => {
    if (!poiCtx) return new Map();
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

  const schematicActions = useMemo(
    () => ({ onCapacityChange }),
    [onCapacityChange]
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

      <div
        className={`flow-schematic-toolbar flex flex-wrap items-center gap-2 border-b border-[var(--border)] pb-3${
          readOnly ? ' flow-schematic-toolbar--readonly' : ''
        }`}
      >
        <span className="text-xs text-[var(--text-muted)] mr-1">Инструмент</span>
        <div className="flow-schematic-edit-tools flex flex-wrap items-center gap-2 flex-1 min-w-0">
        <button
          type="button"
          className={`btn btn-sm ${tool === 'select' ? 'btn-primary' : 'btn-ghost'}`}
          title="Выбор и перемещение"
          disabled={readOnly}
          onClick={() => setTool('select')}
        >
          <MousePointer2 size={16} />
          Выбор
        </button>
        <button
          type="button"
          className={`btn btn-sm ${tool === 'connect' ? 'btn-primary' : 'btn-ghost'}`}
          title="Соединить блоки"
          onClick={() => setTool('connect')}
        >
          <Link2 size={16} />
          Связь
        </button>
        <button
          type="button"
          className={`btn btn-sm ${tool === 'add' ? 'btn-primary' : 'btn-ghost'}`}
          title="Клик по полю — добавить блок"
          onClick={() => setTool('add')}
        >
          <Plus size={16} />
          Блок
        </button>

        {tool === 'connect' && (
          <AppSelectFluid value={connectFluid} onChange={setConnectFluid} />
        )}

        {tool === 'add' && (
          <select
            className="input text-sm py-1 px-2 max-w-[180px]"
            value={addTemplateIndex}
            onChange={(e) => setAddTemplateIndex(Number(e.target.value))}
          >
            {ADD_NODE_TEMPLATES.map((t, i) => (
              <option key={`${t.kind}-${t.label}-${i}`} value={i}>
                {t.label}
              </option>
            ))}
          </select>
        )}

        <span className="flex-1" />

        <button type="button" className="btn btn-sm btn-ghost" onClick={editSelectedLabel} title="Переименовать">
          Подпись…
        </button>
        <button type="button" className="btn btn-sm btn-ghost" onClick={autoLayout} title="Авто-раскладка">
          <LayoutGrid size={16} />
        </button>
        <button type="button" className="btn btn-sm btn-ghost" onClick={deleteSelected} title="Удалить выбранное">
          <Trash2 size={16} />
        </button>
        <button
          type="button"
          className="btn btn-sm btn-primary"
          onClick={handleSave}
          disabled={saving}
        >
          <Save size={16} />
          {saving ? 'Сохранение…' : 'Сохранить'}
        </button>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
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
      </div>

      <p className="text-xs text-[var(--text-muted)]">
        Поток идёт от POI (исходное значение) по цепочке. Блоки с потоком выше пропускной способности
        подсвечиваются красным. Во всплывающем окне — поток и лимит. Двойной клик — переименование.
      </p>
      {overloadCount > 0 && (
        <p className="text-xs text-red-600 font-medium">
          Перегрузка: {overloadCount} блок(ов) — пропускная способность ниже входящего потока.
        </p>
      )}

      <FlowPropagationContext.Provider value={flowMap}>
        <FlowPoiContext.Provider
          value={
            poi
              ? {
                  fluid_type: poi.fluid_type,
                  planned_production_volume: poi.planned_production_volume ?? 0,
                  water_injection_volume: poi.water_injection_volume ?? 0,
                  eng_injection: poi.eng_injection,
                }
              : null
          }
        >
          <FlowSchematicActionsContext.Provider value={schematicActions}>
          <div className="flow-schematic-canvas w-full h-[min(70vh,560px)] rounded-lg border border-[var(--border)] bg-[var(--bg)]">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onPaneClick={onPaneClick}
              onNodeDoubleClick={(_e, node) => renameNode(node as Node<FlowNodeData>)}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              nodesDraggable={!readOnly && tool === 'select'}
              nodesConnectable={!readOnly && tool === 'connect'}
              elementsSelectable={!readOnly}
              deleteKeyCode={readOnly ? null : ['Backspace', 'Delete']}
              panOnDrag
              zoomOnPinch
              zoomOnScroll={!isMobile}
              selectionOnDrag={!readOnly && tool === 'select'}
              proOptions={{ hideAttribution: true }}
            >
              <Background gap={16} color="var(--border)" />
              <Controls showInteractive={false} />
            </ReactFlow>
          </div>
          </FlowSchematicActionsContext.Provider>
        </FlowPoiContext.Provider>
      </FlowPropagationContext.Provider>

      <p className="text-xs text-[var(--text-muted)]">
        {isCustom
          ? 'Сохранена пользовательская схема. «Сброс» удалит правки и пересчитает схему по POI и сети.'
          : '«Пересчитать» обновит схему после изменения параметров POI или инфраструктуры на карте.'}
      </p>
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
      className="input text-sm py-1 px-2"
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
