import { useCallback, useEffect, useRef, useState } from 'react';
import type { FlowNodeData } from '../../lib/flowSchematic';
import {
  capacityUnitLabel,
  formatCapacity,
  nodeHasThroughputCapacity,
  parseCapacityInput,
  resolveCapacityUnit,
} from '../../lib/flowSchematic';
import { useFlowPoi, useFlowSchematicActions } from '../../lib/flowSchematicContext';
import { capacityValuesEqual } from './helpers';

export function FlowCapacityPopover({
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
        {showCapacity
          ? isPoiNode
            ? poiCtx?.fluid_type === 'gas'
              ? 'Плановый дебит газа'
              : 'Плановый дебит нефти'
            : 'Пропускная способность'
          : data.label}
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
