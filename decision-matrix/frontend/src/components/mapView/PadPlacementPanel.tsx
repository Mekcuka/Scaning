import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  LayoutGrid,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import type { MapGroupSelectionItem } from './MapGroupSelectionPanel';
import { PadPlacementParamsSection } from './PadPlacementParamsSection';
import type {
  PadPlacementComputeResponse,
  PadPlacementParams,
} from '../../lib/padPlacementTypes';
import { iconDataUrl } from '../../lib/mapIcons';

type Props = {
  items: MapGroupSelectionItem[];
  visibleEligibleCount: number;
  params: PadPlacementParams;
  onParamsChange: (next: PadPlacementParams) => void;
  subtype: 'oil_pad' | 'gas_pad';
  onSubtypeChange: (v: 'oil_pad' | 'gas_pad') => void;
  computeResult: PadPlacementComputeResponse | null;
  selectedVariantIndex: number | null;
  onSelectVariant: (index: number) => void;
  onClose: () => void;
  onClear: () => void;
  onRemoveItem: (id: string) => void;
  onAddVisible: () => void;
  onCompute: () => void;
  onApply: () => void;
  canCompute: boolean;
  disabledHint?: string | null;
  computePending: boolean;
  applyPending: boolean;
};

function bottomholeIcon(subtype?: string): string {
  if (subtype === 'well_bottomhole_gs_heel') return iconDataUrl('well_bottomhole_gs_heel');
  return iconDataUrl('well_bottomhole_nnb');
}

export function PadPlacementPanel({
  items,
  visibleEligibleCount,
  params,
  onParamsChange,
  subtype,
  onSubtypeChange,
  computeResult,
  selectedVariantIndex,
  onSelectVariant,
  onClose,
  onClear,
  onRemoveItem,
  onAddVisible,
  onCompute,
  onApply,
  canCompute,
  disabledHint,
  computePending,
  applyPending,
}: Props) {
  const [listCollapsed, setListCollapsed] = useState(() => items.length === 0);
  const busy = computePending || applyPending;

  const selectedVariant = useMemo(
    () =>
      computeResult?.variants.find((v) => v.variant_index === selectedVariantIndex) ?? null,
    [computeResult, selectedVariantIndex],
  );

  useEffect(() => {
    if (items.length === 0) setListCollapsed(true);
  }, [items.length]);

  const statusLabel =
    items.length === 0
      ? 'выберите забои'
      : computeResult
        ? `${computeResult.variants.length} вариант(ов)`
        : 'готово к расчёту';

  return (
    <div
      className="map-group-panel map-group-panel--autoroad pad-placement-panel"
      role="region"
      aria-label="Оптимизация размещения кустов"
    >
      <header className="map-group-panel__header">
        <div className="map-group-panel__title-row">
          <LayoutGrid size={16} className="map-group-panel__title-icon" aria-hidden />
          <div className="map-group-panel__title-text">
            <span className="map-group-panel__title">Оптимизация кустов</span>
            <span className="map-group-panel__count">
              {items.length} заб.
              {computeResult ? ` · ${computeResult.logical_well_count} скв.` : ''}
              {' · '}
              {statusLabel}
            </span>
          </div>
          <div className="map-group-panel__header-actions">
            <button
              type="button"
              className="btn btn-ghost btn-icon-touch map-group-panel__icon-btn"
              onClick={onClose}
              title="Закрыть"
              aria-label="Закрыть"
            >
              <X size={16} />
            </button>
          </div>
        </div>
        <p className="map-group-panel__summary">
          Greenfield: создаются только новые кусты. Клик или рамка на карте — выбор забоев (ННБ /
          пятка ГС).
        </p>
      </header>

      <div className="pad-placement-panel__toolbar">
        <button
          type="button"
          className="pad-placement-panel__bulk-btn"
          disabled={visibleEligibleCount === 0 || busy}
          title="Добавить забои в видимой области карты"
          onClick={onAddVisible}
        >
          <Plus size={12} aria-hidden />
          Видимые ({visibleEligibleCount})
        </button>
      </div>

      <div className="pad-placement-panel__body">
        <PadPlacementParamsSection
          params={params}
          onChange={onParamsChange}
          subtype={subtype}
          onSubtypeChange={onSubtypeChange}
          disabled={busy}
        />

        <div className="pad-placement-panel__list-header">
          <button
            type="button"
            className="pad-placement-panel__list-toggle"
            onClick={() => setListCollapsed((v) => !v)}
            aria-expanded={!listCollapsed}
          >
            {listCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            <span>Забои</span>
            <span className="pad-placement-panel__list-count">{items.length}</span>
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm p-1"
            disabled={items.length === 0 || busy}
            title="Очистить список"
            aria-label="Очистить список"
            onClick={onClear}
          >
            <Trash2 size={14} />
          </button>
        </div>

        {!listCollapsed && (
          <div className="map-group-panel__list-wrap pad-placement-panel__list-wrap">
            {items.length === 0 ? (
              <p className="map-group-panel__empty">
                Выберите забои на карте или нажмите «Видимые».
              </p>
            ) : (
              <ul className="pad-placement-panel__items">
                {items.map((item) => (
                  <li key={item.id} className="pad-placement-panel__item">
                    <img
                      src={bottomholeIcon(item.subtype)}
                      alt=""
                      className="pad-placement-panel__item-icon"
                      draggable={false}
                    />
                    <div className="pad-placement-panel__item-main">
                      <span className="pad-placement-panel__item-name" title={item.name}>
                        {item.name}
                      </span>
                      <span className="pad-placement-panel__item-sub">{item.subtitle}</span>
                    </div>
                    <button
                      type="button"
                      className="pad-placement-panel__item-remove"
                      title="Убрать из списка"
                      aria-label={`Убрать ${item.name}`}
                      disabled={busy}
                      onClick={() => onRemoveItem(item.id)}
                    >
                      <X size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {computeResult && computeResult.variants.length > 0 ? (
          <div className="pad-placement-panel__variants">
            <span className="pad-placement-panel__variants-title">Варианты</span>
            <p className="pad-placement-panel__variants-meta">
              Клик по строке — предпросмотр на карте. Сортировка: меньше кустов → меньше Σ MD →
              SF.
            </p>
            <div className="pad-placement-panel__table-wrap">
              <table className="pad-placement-panel__table">
                <thead>
                  <tr>
                    <th>№</th>
                    <th>Кустов</th>
                    <th>Σ MD, м</th>
                    {params.sf_check ? <th>min SF</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {computeResult.variants.map((v) => {
                    const sfLow =
                      params.sf_check &&
                      v.min_sf != null &&
                      v.min_sf < (params.sf_threshold ?? 1);
                    const selected = selectedVariantIndex === v.variant_index;
                    return (
                      <tr
                        key={v.variant_index}
                        className={`pad-placement-panel__row${selected ? ' pad-placement-panel__row--selected' : ''}`}
                        onClick={() => onSelectVariant(v.variant_index)}
                      >
                        <td>{v.variant_index + 1}</td>
                        <td>{v.pad_count}</td>
                        <td>{Math.round(v.sum_md_m).toLocaleString('ru-RU')}</td>
                        {params.sf_check ? (
                          <td className={sfLow ? 'pad-placement-panel__sf-warn' : undefined}>
                            {v.min_sf != null ? (
                              <span className="pad-placement-panel__sf-cell">
                                {sfLow ? <AlertTriangle size={11} aria-hidden /> : null}
                                {v.min_sf.toFixed(2)}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {selectedVariant && selectedVariant.score_warnings.length > 0 ? (
              <ul className="pad-placement-panel__warnings">
                {selectedVariant.score_warnings.slice(0, 4).map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {!canCompute && disabledHint ? (
          <p className="pad-placement-panel__hint">{disabledHint}</p>
        ) : null}
        {computePending ? (
          <p className="pad-placement-panel__hint">
            Расчёт на сервере — для нескольких забоев может занять до минуты.
          </p>
        ) : null}
      </div>

      <footer className="pad-placement-panel__footer">
        <button
          type="button"
          className="btn btn-primary btn-sm flex-1"
          disabled={!canCompute || computePending}
          onClick={onCompute}
        >
          {computePending ? 'Расчёт…' : 'Рассчитать'}
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm flex-1"
          disabled={!computeResult || selectedVariantIndex == null || applyPending}
          onClick={onApply}
        >
          {applyPending ? 'Применение…' : 'Применить'}
        </button>
      </footer>
    </div>
  );
}
