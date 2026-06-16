import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';

import type { TransposedSummaryTable } from '../../lib/padClusteringSummaryRows';
import {
  SUMMARY_ROW_SORT_KEY,
  buildSummaryFilterOptions,
  filterSummaryRows,
  hasActiveSummaryFilters,
  sortSummaryRows,
  type SummarySortDirection,
} from '../../lib/padClusteringSummaryTableView';

type Props = {
  title: string;
  table: TransposedSummaryTable;
  emptyHint?: string;
  rowHeaderLabel?: string;
};

type SortState = {
  key: string;
  direction: SummarySortDirection;
};

function SortIndicator({
  active,
  direction,
}: {
  active: boolean;
  direction: SummarySortDirection;
}) {
  if (!active) return <span className="pad-clustering-summary__sort-indicator">↕</span>;
  return (
    <span className="pad-clustering-summary__sort-indicator pad-clustering-summary__sort-indicator--active">
      {direction === 'asc' ? '↑' : '↓'}
    </span>
  );
}

function ColumnHeader({
  label,
  columnKey,
  sort,
  onSort,
  filterOptions,
  filterValue,
  onFilterChange,
  className,
  rowSpan,
  colSpan,
  scope,
  sortable,
}: {
  label: string;
  columnKey: string;
  sort: SortState;
  onSort: (key: string) => void;
  filterOptions?: string[];
  filterValue?: string;
  onFilterChange?: (key: string, value: string) => void;
  className?: string;
  rowSpan?: number;
  colSpan?: number;
  scope?: 'col' | 'colgroup';
  sortable: boolean;
}) {
  const active = sort.key === columnKey;
  const showFilter = filterOptions != null && filterOptions.length > 0 && onFilterChange != null;

  return (
    <th
      scope={scope ?? 'col'}
      rowSpan={rowSpan}
      colSpan={colSpan}
      className={`${className ?? ''} ${sortable ? 'pad-clustering-summary__col-head--sortable' : ''}`.trim()}
      aria-sort={sortable && active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <div className="pad-clustering-summary__header-stack">
        {sortable ? (
          <button
            type="button"
            className="pad-clustering-summary__sort-btn"
            onClick={() => onSort(columnKey)}
          >
            <span>{label}</span>
            <SortIndicator active={active} direction={sort.direction} />
          </button>
        ) : (
          <span className="pad-clustering-summary__header-label">{label}</span>
        )}
        {showFilter ? (
          <select
            className="app-select pad-clustering-summary__header-filter"
            value={filterValue ?? ''}
            onChange={(event) => onFilterChange(columnKey, event.target.value)}
            aria-label={`Фильтр: ${label}`}
          >
            <option value="">Все</option>
            {filterOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        ) : null}
      </div>
    </th>
  );
}

export function PadClusteringSummaryTable({
  title,
  table,
  emptyHint,
  rowHeaderLabel = 'Объект',
}: Props) {
  const hasRows = table.rows.length > 0;
  const hasGroupedColumns = table.columns.some((col) => col.kind === 'group');
  const sortable = table.rows.length > 1;

  const [search, setSearch] = useState('');
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<SortState>({ key: SUMMARY_ROW_SORT_KEY, direction: 'asc' });

  const filterOptionsByKey = useMemo(
    () => (hasRows ? buildSummaryFilterOptions(table, table.rows) : {}),
    [hasRows, table],
  );

  const visibleRows = useMemo(() => {
    const filtered = filterSummaryRows(table.rows, table.paramLabels, { search, columnFilters });
    return sortable ? sortSummaryRows(filtered, sort.key, sort.direction) : filtered;
  }, [table.rows, table.paramLabels, search, columnFilters, sortable, sort.key, sort.direction]);

  const filtersActive = hasActiveSummaryFilters(search, columnFilters);

  const handleSort = (key: string) => {
    setSort((prev) => ({
      key,
      direction: prev.key === key ? (prev.direction === 'asc' ? 'desc' : 'asc') : 'asc',
    }));
  };

  const handleFilterChange = (key: string, value: string) => {
    setColumnFilters((prev) => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setSearch('');
    setColumnFilters({});
  };

  const renderColumnHeader = (
    label: string,
    columnKey: string,
    className?: string,
    rowSpan?: number,
    colSpan?: number,
    scope?: 'col' | 'colgroup',
  ) => (
    <ColumnHeader
      key={columnKey}
      label={label}
      columnKey={columnKey}
      sort={sort}
      onSort={handleSort}
      filterOptions={filterOptionsByKey[columnKey]}
      filterValue={columnFilters[columnKey]}
      onFilterChange={handleFilterChange}
      className={className}
      rowSpan={rowSpan}
      colSpan={colSpan}
      scope={scope}
      sortable={sortable}
    />
  );

  return (
    <section className="pad-clustering-summary__section">
      <h3 className="pad-clustering-summary__title">{title}</h3>
      {hasRows && table.rows.length > 1 ? (
        <div className="pad-clustering-summary__toolbar">
          <label className="pad-clustering-summary__search">
            <Search size={15} aria-hidden />
            <input
              type="search"
              className="input"
              placeholder="Поиск по таблице…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label={`Поиск: ${title}`}
            />
          </label>
          <div className="pad-clustering-summary__toolbar-meta">
            <span className="pad-clustering-summary__count">
              Показано {visibleRows.length} из {table.rows.length}
            </span>
            {filtersActive ? (
              <button
                type="button"
                className="btn btn--secondary btn--sm pad-clustering-summary__reset"
                onClick={resetFilters}
              >
                Сбросить
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className="pad-clustering-summary__table-wrap">
        {!hasRows ? (
          <p className="pad-clustering-summary__empty pad-clustering-section__hint">{emptyHint ?? '—'}</p>
        ) : visibleRows.length === 0 ? (
          <p className="pad-clustering-summary__empty pad-clustering-section__hint">
            Нет строк по заданным фильтрам.
          </p>
        ) : (
          <table className="pad-clustering-table text-xs pad-clustering-summary__table pad-clustering-summary__table--transposed">
            <thead>
              {hasGroupedColumns ? (
                <>
                  <tr>
                    {renderColumnHeader(
                      rowHeaderLabel,
                      SUMMARY_ROW_SORT_KEY,
                      'pad-clustering-summary__row-head pad-clustering-summary__row-head--corner',
                      2,
                    )}
                    {table.columns.map((col) =>
                      col.kind === 'single' ? (
                        renderColumnHeader(
                          col.label,
                          col.key,
                          'pad-clustering-summary__col-head',
                          2,
                        )
                      ) : (
                        <th
                          key={col.label}
                          scope="colgroup"
                          colSpan={col.columns.length}
                          className="pad-clustering-summary__col-group"
                        >
                          {col.label}
                        </th>
                      ),
                    )}
                  </tr>
                  <tr>
                    {table.columns.flatMap((col) =>
                      col.kind === 'group'
                        ? col.columns.map((child) =>
                            renderColumnHeader(
                              child.label,
                              child.key,
                              'pad-clustering-summary__col-subhead',
                            ),
                          )
                        : [],
                    )}
                  </tr>
                </>
              ) : (
                <tr>
                  {renderColumnHeader(rowHeaderLabel, SUMMARY_ROW_SORT_KEY, 'pad-clustering-summary__row-head')}
                  {table.columns.map((col) =>
                    col.kind === 'single'
                      ? renderColumnHeader(col.label, col.key, 'pad-clustering-summary__col-head')
                      : null,
                  )}
                </tr>
              )}
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.key}>
                  <th scope="row" className="pad-clustering-summary__row-head">
                    {row.label}
                  </th>
                  {table.paramLabels.map((key) => (
                    <td key={key}>{row.values[key] ?? '—'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
