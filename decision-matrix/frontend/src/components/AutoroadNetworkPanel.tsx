import { useEffect, useMemo, useState } from 'react';
import {
  BoxSelect,
  ChevronDown,
  ChevronRight,
  MousePointer2,
  Plus,
  Route,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from 'antd';
import type { MapGroupSelectionItem } from './MapGroupSelectionPanel';
import {
  AutoroadNetworkParamsSection,
  type SolverStatus,
} from './AutoroadNetworkParamsSection';
import type { AutoroadNetworkPickMode } from '../lib/autoroadNetwork';
import type { AutoroadPlannerOptions } from '../lib/autoroadNetworkPlannerOptions';
import {
  TERMINAL_ROLE_LABELS,
  terminalRoleForIndex,
} from '../lib/autoroadNetworkPlannerOptions';
import { MAP_SUBTYPE_COLORS } from '../lib/mapIcons';

export type AutoroadSubtypeBulkOption = {
  subtype: string;
  label: string;
  projectCount: number;
  visibleCount: number;
};

type Props = {
  items: MapGroupSelectionItem[];
  pickMode: AutoroadNetworkPickMode;
  onPickModeChange: (mode: AutoroadNetworkPickMode) => void;
  onClose: () => void;
  onClear: () => void;
  onRemoveItem: (id: string) => void;
  onAddVisible: () => void;
  onAddBySubtype: (subtype: string) => void;
  visibleEligibleCount: number;
  subtypeBulkOptions: AutoroadSubtypeBulkOption[];
  onPreview: () => void;
  canPreview: boolean;
  disabledHint?: string | null;
  pending?: boolean;
  plannerOptions: AutoroadPlannerOptions;
  onPlannerOptionsChange: (next: AutoroadPlannerOptions) => void;
  solverStatus: SolverStatus | null;
  solverStatusLoading?: boolean;
};

const ROLE_CLASS: Record<string, string> = {
  start: 'autoroad-network-panel__role--start',
  end: 'autoroad-network-panel__role--end',
  intermediate: 'autoroad-network-panel__role--mid',
};

export function AutoroadNetworkPanel({
  items,
  pickMode,
  onPickModeChange,
  onClose,
  onClear,
  onRemoveItem,
  onAddVisible,
  onAddBySubtype,
  visibleEligibleCount,
  subtypeBulkOptions,
  onPreview,
  canPreview,
  disabledHint = null,
  pending = false,
  plannerOptions,
  onPlannerOptionsChange,
  solverStatus,
  solverStatusLoading = false,
}: Props) {
  const [listCollapsed, setListCollapsed] = useState(() => items.length === 0);
  const [query, setQuery] = useState('');

  const normalizedQuery = query.trim().toLowerCase();
  const showSearch = items.length > 6;

  const filteredItems = useMemo(() => {
    if (!normalizedQuery) return items;
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(normalizedQuery) ||
        item.subtitle.toLowerCase().includes(normalizedQuery),
    );
  }, [items, normalizedQuery]);

  useEffect(() => {
    if (items.length === 0) setListCollapsed(true);
  }, [items.length]);

  return (
    <div
      className="map-group-panel map-group-panel--autoroad"
      role="region"
      aria-label="Построение сети автодорог"
    >
      <header className="map-group-panel__header">
        <div className="map-group-panel__title-row">
          <Route size={16} className="map-group-panel__title-icon" aria-hidden />
          <div className="map-group-panel__title-text">
            <span className="map-group-panel__title">Сеть автодорог</span>
            <span className="map-group-panel__count">
              {items.length} терм.
              {items.length >= 2 ? ' · готово' : ' · нужно ≥ 2'}
              {' · '}
              {pickMode === 'box' ? 'рамка' : 'клик'}
            </span>
          </div>
          <div className="map-group-panel__header-actions">
            <Button
              type="text"
              size="small"
              className="map-group-panel__icon-btn"
              icon={<X size={16} />}
              onClick={onClose}
              title="Закрыть"
              aria-label="Закрыть"
            />
          </div>
        </div>
      </header>

      <div className="autoroad-network-panel__toolbar">
        <div
          className="map-display-mode-toggle autoroad-network-panel__pick-toggle"
          role="group"
          aria-label="Способ выбора терминалов"
        >
          <Button
            size="small"
            type={pickMode === 'click' ? 'primary' : 'default'}
            className={`map-tool-btn rounded-none border-0${pickMode === 'click' ? ' active' : ''}`}
            icon={<MousePointer2 size={13} aria-hidden />}
            title="Клик по объекту"
            aria-label="По клику"
            aria-pressed={pickMode === 'click'}
            onClick={() => onPickModeChange('click')}
          />
          <Button
            size="small"
            type={pickMode === 'box' ? 'primary' : 'default'}
            className={`map-tool-btn rounded-none border-0${pickMode === 'box' ? ' active' : ''}`}
            icon={<BoxSelect size={13} aria-hidden />}
            title="Рамка на карте"
            aria-label="Рамкой"
            aria-pressed={pickMode === 'box'}
            onClick={() => onPickModeChange('box')}
          />
        </div>
        <button
          type="button"
          className="autoroad-network-panel__bulk-btn"
          disabled={visibleEligibleCount === 0 || pending}
          title="Добавить подходящие точки в видимой области"
          onClick={onAddVisible}
        >
          <Plus size={12} aria-hidden />
          Видимые ({visibleEligibleCount})
        </button>
        {subtypeBulkOptions.length > 0 ? (
          <select
            className="autoroad-network-panel__subtype-select"
            defaultValue=""
            disabled={pending}
            aria-label="Добавить все объекты типа"
            onChange={(e) => {
              const subtype = e.target.value;
              if (!subtype) return;
              onAddBySubtype(subtype);
              e.target.value = '';
            }}
          >
            <option value="">Тип…</option>
            {subtypeBulkOptions.map((opt) => (
              <option key={opt.subtype} value={opt.subtype}>
                {opt.label} ({opt.visibleCount > 0 ? opt.visibleCount : opt.projectCount})
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <div className="autoroad-network-panel__body">
      <AutoroadNetworkParamsSection
        options={plannerOptions}
        onChange={onPlannerOptionsChange}
        solverStatus={solverStatus}
        statusLoading={solverStatusLoading}
      />

      <div className="autoroad-network-panel__list-header">
        <button
          type="button"
          className="autoroad-network-panel__list-toggle"
          onClick={() => setListCollapsed((v) => !v)}
          aria-expanded={!listCollapsed}
        >
          {listCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          <span>Терминалы</span>
          <span className="autoroad-network-panel__list-count">{items.length}</span>
        </button>
        <Button
          type="text"
          size="small"
          icon={<Trash2 size={14} />}
          disabled={items.length === 0 || pending}
          title="Очистить список"
          aria-label="Очистить список"
          onClick={onClear}
        />
      </div>

      {!listCollapsed && (
        <>
          {showSearch && (
            <label className="map-group-panel__search">
              <Search size={14} className="map-group-panel__search-icon" aria-hidden />
              <input
                type="search"
                className="map-group-panel__search-input"
                placeholder="Поиск в списке…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Поиск терминала"
              />
              {query ? (
                <button
                  type="button"
                  className="map-group-panel__search-clear"
                  onClick={() => setQuery('')}
                  aria-label="Очистить поиск"
                >
                  <X size={12} />
                </button>
              ) : null}
            </label>
          )}

          <div className="map-group-panel__list-wrap autoroad-network-panel__list-wrap">
            {items.length === 0 ? (
              <p className="map-group-panel__empty">
                Выберите объекты на карте или добавьте видимые / по типу.
              </p>
            ) : filteredItems.length === 0 ? (
              <p className="map-group-panel__empty">Ничего не найдено</p>
            ) : (
              <ul className="autoroad-network-panel__items">
                {filteredItems.map((item) => {
                  const index = items.findIndex((x) => x.id === item.id);
                  const role = terminalRoleForIndex(index, items.length);
                  return (
                    <li key={item.id} className="autoroad-network-panel__item">
                      <span
                        className="map-group-panel__item-dot"
                        style={{
                          background:
                            MAP_SUBTYPE_COLORS[item.subtype ?? 'node'] ?? '#888',
                        }}
                        aria-hidden
                      />
                      <div className="autoroad-network-panel__item-main">
                        <span className="autoroad-network-panel__item-name" title={item.name}>
                          {item.name}
                        </span>
                        <span className="autoroad-network-panel__item-sub">{item.subtitle}</span>
                      </div>
                      <span
                        className={`autoroad-network-panel__role ${ROLE_CLASS[role] ?? ''}`}
                        title={`Роль: ${TERMINAL_ROLE_LABELS[role]}`}
                      >
                        {TERMINAL_ROLE_LABELS[role]}
                      </span>
                      <button
                        type="button"
                        className="autoroad-network-panel__item-remove"
                        title="Убрать из списка"
                        aria-label={`Убрать ${item.name}`}
                        disabled={pending}
                        onClick={() => onRemoveItem(item.id)}
                      >
                        <X size={12} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}

      {!canPreview && disabledHint ? (
        <p className="autoroad-network-panel__hint">{disabledHint}</p>
      ) : null}
      {pending ? (
        <p className="autoroad-network-panel__hint">
          Расчёт на сервере — для большого числа объектов может занять до минуты. После расчёта
          подтвердите применение в диалоге — только тогда линии появятся на карте.
        </p>
      ) : null}
      </div>

      <footer className="autoroad-network-panel__footer">
        <Button
          type="primary"
          size="small"
          block
          className="flex-1"
          disabled={!canPreview || pending}
          loading={pending}
          onClick={onPreview}
        >
          {pending ? 'Расчёт…' : 'Рассчитать'}
        </Button>
      </footer>
    </div>
  );
}
