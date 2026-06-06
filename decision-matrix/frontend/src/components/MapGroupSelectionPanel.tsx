import { useEffect, useMemo, useState } from 'react';
import {
  BoxSelect,
  ChevronDown,
  ChevronRight,
  ClipboardPaste,
  Copy,
  Minus,
  Scissors,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { LINE_SUBTYPES } from '../lib/api';
import { MAP_SUBTYPE_COLORS } from '../lib/mapIcons';

export type MapGroupSelectionItem = {
  id: string;
  name: string;
  kind: 'poi' | 'infra';
  subtype?: string;
  subtitle: string;
};

type Props = {
  items: MapGroupSelectionItem[];
  onClear: () => void;
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  onDelete: () => void;
  canCopy: boolean;
  canCut: boolean;
  canPaste: boolean;
  canDelete: boolean;
  deletePending?: boolean;
};

function isLineSubtype(subtype?: string): boolean {
  if (!subtype) return false;
  return LINE_SUBTYPES.includes(subtype as (typeof LINE_SUBTYPES)[number]);
}

function summaryParts(items: MapGroupSelectionItem[]): string[] {
  let lines = 0;
  let points = 0;
  let pois = 0;
  for (const item of items) {
    if (item.kind === 'poi') pois += 1;
    else if (isLineSubtype(item.subtype)) lines += 1;
    else points += 1;
  }
  const parts: string[] = [];
  if (lines > 0) parts.push(`${lines} ${lines === 1 ? 'линия' : lines < 5 ? 'линии' : 'линий'}`);
  if (points > 0) parts.push(`${points} ${points === 1 ? 'точка' : points < 5 ? 'точки' : 'точек'}`);
  if (pois > 0) parts.push(`${pois} POI`);
  return parts;
}

export function MapGroupSelectionPanel({
  items,
  onClear,
  onCopy,
  onCut,
  onPaste,
  onDelete,
  canCopy,
  canCut,
  canPaste,
  canDelete,
  deletePending = false,
}: Props) {
  const [query, setQuery] = useState('');
  const [listCollapsed, setListCollapsed] = useState(true);
  /** Пустой набор = все группы свёрнуты при открытии панели. */
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set());

  const selectionKey = useMemo(
    () => items.map((i) => i.id).sort().join('\u0001'),
    [items],
  );

  useEffect(() => {
    setExpandedGroups(new Set());
    setQuery('');
    setListCollapsed(true);
  }, [selectionKey]);

  const normalizedQuery = query.trim().toLowerCase();
  const showSearch = items.length > 8;

  const filtered = useMemo(() => {
    if (!normalizedQuery) return items;
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(normalizedQuery) ||
        item.subtitle.toLowerCase().includes(normalizedQuery),
    );
  }, [items, normalizedQuery]);

  const groups = useMemo(() => {
    const map = new Map<string, MapGroupSelectionItem[]>();
    for (const item of filtered) {
      const key = item.subtitle;
      const list = map.get(key);
      if (list) list.push(item);
      else map.set(key, [item]);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b, 'ru'))
      .map(([label, groupItems]) => ({
        label,
        items: groupItems.sort((x, y) => x.name.localeCompare(y.name, 'ru')),
      }));
  }, [filtered]);

  useEffect(() => {
    if (!normalizedQuery) return;
    setExpandedGroups(new Set(groups.map((g) => g.label)));
  }, [normalizedQuery, groups]);

  const summary = summaryParts(items);

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const expandAllGroups = () => {
    setExpandedGroups(new Set(groups.map((g) => g.label)));
  };

  const collapseAllGroups = () => {
    setExpandedGroups(new Set());
  };

  return (
    <div className="map-group-panel" role="region" aria-label="Групповое выделение на карте">
      <header className="map-group-panel__header">
        <div className="map-group-panel__title-row">
          <BoxSelect size={16} className="map-group-panel__title-icon" aria-hidden />
          <div className="map-group-panel__title-text">
            <span className="map-group-panel__title">Группа объектов</span>
            <span className="map-group-panel__count">Выбрано: {items.length}</span>
          </div>
          <div className="map-group-panel__header-actions">
            <button
              type="button"
              className="btn btn-ghost btn-icon-touch map-group-panel__icon-btn"
              onClick={() => setListCollapsed((v) => !v)}
              title={listCollapsed ? 'Развернуть список' : 'Свернуть список'}
              aria-label={listCollapsed ? 'Развернуть список' : 'Свернуть список'}
              aria-expanded={!listCollapsed}
            >
              {listCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-icon-touch map-group-panel__icon-btn"
              onClick={onClear}
              title="Сбросить выделение"
              aria-label="Сбросить выделение"
            >
              <X size={16} />
            </button>
          </div>
        </div>
        {summary.length > 0 && (
          <p className="map-group-panel__summary">{summary.join(' · ')}</p>
        )}
      </header>

      {!listCollapsed && (
        <>
          {groups.length > 1 && (
            <div className="map-group-panel__bulk-actions">
              <button
                type="button"
                className="map-group-panel__bulk-btn"
                onClick={expandAllGroups}
              >
                Развернуть все
              </button>
              <button
                type="button"
                className="map-group-panel__bulk-btn"
                onClick={collapseAllGroups}
              >
                Свернуть все
              </button>
            </div>
          )}

          {showSearch && (
            <label className="map-group-panel__search">
              <Search size={14} className="map-group-panel__search-icon" aria-hidden />
              <input
                type="search"
                className="map-group-panel__search-input"
                placeholder="Поиск в выделении…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Поиск в выделении"
              />
              {query && (
                <button
                  type="button"
                  className="map-group-panel__search-clear"
                  onClick={() => setQuery('')}
                  aria-label="Очистить поиск"
                >
                  <X size={12} />
                </button>
              )}
            </label>
          )}

          <div className="map-group-panel__list-wrap">
            {filtered.length === 0 ? (
              <p className="map-group-panel__empty">Ничего не найдено</p>
            ) : (
              <ul className="map-group-panel__groups">
                {groups.map((group) => {
                  const groupExpanded = expandedGroups.has(group.label);
                  return (
                    <li key={group.label} className="map-group-panel__group">
                      <button
                        type="button"
                        className="map-group-panel__group-head"
                        onClick={() => toggleGroup(group.label)}
                        aria-expanded={groupExpanded}
                      >
                        {groupExpanded ? (
                          <ChevronDown size={14} aria-hidden />
                        ) : (
                          <ChevronRight size={14} aria-hidden />
                        )}
                        <span
                          className="map-group-panel__group-dot"
                          style={{
                            background:
                              MAP_SUBTYPE_COLORS[group.items[0]?.subtype ?? 'node'] ?? '#888',
                          }}
                          aria-hidden
                        />
                        <span className="map-group-panel__group-label">{group.label}</span>
                        <span className="map-group-panel__group-count">{group.items.length}</span>
                      </button>
                      {groupExpanded && (
                        <ul className="map-group-panel__items">
                          {group.items.map((item) => (
                            <li key={item.id} className="map-group-panel__item">
                              <span
                                className="map-group-panel__item-dot"
                                style={{
                                  background:
                                    MAP_SUBTYPE_COLORS[item.subtype ?? (item.kind === 'poi' ? 'poi' : 'node')] ??
                                    '#888',
                                }}
                                aria-hidden
                              />
                              <span className="map-group-panel__item-name" title={item.name}>
                                {item.name}
                              </span>
                              {isLineSubtype(item.subtype) && (
                                <Minus size={12} className="map-group-panel__item-line-icon" aria-hidden />
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <p className="map-group-panel__hint">
            Перетащите выделение · клик в пустое — снять
          </p>
        </>
      )}

      <div className="map-group-panel__actions">
        <button
          type="button"
          className="btn btn-secondary map-group-panel__action"
          disabled={!canCopy}
          title="Копировать (Ctrl+C)"
          onClick={onCopy}
        >
          <Copy size={14} aria-hidden />
          <span>Копировать</span>
        </button>
        <button
          type="button"
          className="btn btn-secondary map-group-panel__action"
          disabled={!canPaste}
          title="Вставить (Ctrl+V)"
          onClick={onPaste}
        >
          <ClipboardPaste size={14} aria-hidden />
          <span>Вставить</span>
        </button>
        <button
          type="button"
          className="btn btn-secondary map-group-panel__action"
          disabled={!canCut}
          title="Вырезать (Ctrl+X)"
          onClick={onCut}
        >
          <Scissors size={14} aria-hidden />
          <span>Вырезать</span>
        </button>
        <button
          type="button"
          className="btn btn-secondary map-group-panel__action map-group-panel__action--danger"
          disabled={!canDelete || deletePending}
          title={canDelete ? 'Удалить (Del)' : 'Недостаточно прав'}
          onClick={onDelete}
        >
          <Trash2 size={14} aria-hidden />
          <span>{deletePending ? 'Удаление…' : 'Удалить'}</span>
        </button>
      </div>
    </div>
  );
}
