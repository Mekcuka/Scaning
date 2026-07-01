import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Button, Input } from 'antd';
import type { ColumnsType } from 'antd/es/table';

import { AppSelect } from '../AppSelect';
import { AppDataTable } from '../AppDataTable';
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

type SummaryDataRow = {
  key: string;
  label: string;
  [paramKey: string]: string | undefined;
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
  sortable: boolean;
}) {
  const active = sort.key === columnKey;
  const showFilter = filterOptions != null && filterOptions.length > 0 && onFilterChange != null;

  return (
    <div
      className={`pad-clustering-summary__header-stack ${className ?? ''} ${sortable ? 'pad-clustering-summary__col-head--sortable' : ''}`.trim()}
      aria-sort={sortable && active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      {sortable ? (
        <Button
          type="text"
          size="small"
          className="pad-clustering-summary__sort-btn"
          onClick={() => onSort(columnKey)}
        >
          <span>{label}</span>
          <SortIndicator active={active} direction={sort.direction} />
        </Button>
      ) : (
        <span className="pad-clustering-summary__header-label">{label}</span>
      )}
      {showFilter ? (
        <AppSelect
          variant="compact"
          className="pad-clustering-summary__header-filter"
          value={filterValue ?? ''}
          ariaLabel={`Фильтр: ${label}`}
          onChange={(value) => onFilterChange(columnKey, value)}
          options={[
            { value: '', label: 'Все' },
            ...filterOptions.map((option) => ({ value: option, label: option })),
          ]}
        />
      ) : null}
    </div>
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

  const dataSource = useMemo<SummaryDataRow[]>(
    () =>
      visibleRows.map((row) => ({
        key: row.key,
        label: row.label,
        ...row.values,
      })),
    [visibleRows],
  );

  const columns = useMemo<ColumnsType<SummaryDataRow>>(() => {
    const mkHeader = (label: string, columnKey: string, className?: string) => (
      <ColumnHeader
        label={label}
        columnKey={columnKey}
        sort={sort}
        onSort={handleSort}
        filterOptions={filterOptionsByKey[columnKey]}
        filterValue={columnFilters[columnKey]}
        onFilterChange={handleFilterChange}
        className={className}
        sortable={sortable}
      />
    );

    const labelColumn: ColumnsType<SummaryDataRow>[number] = {
      title: mkHeader(rowHeaderLabel, SUMMARY_ROW_SORT_KEY, 'pad-clustering-summary__row-head'),
      dataIndex: 'label',
      key: SUMMARY_ROW_SORT_KEY,
      fixed: 'left',
      className: 'pad-clustering-summary__row-head',
      onHeaderCell: () => ({
        className: [
          'pad-clustering-summary__row-head',
          'pad-clustering-summary__row-head--corner',
          hasGroupedColumns ? 'pad-clustering-summary__row-head--grouped' : '',
        ]
          .filter(Boolean)
          .join(' '),
        ...(hasGroupedColumns ? { rowSpan: 2 } : {}),
      }),
      onCell: () => ({ className: 'pad-clustering-summary__row-head' }),
      render: (label: string) => label,
    };

    const metricColumns: ColumnsType<SummaryDataRow> = table.columns.map((col) => {
      if (col.kind === 'single') {
        return {
          title: mkHeader(col.label, col.key, 'pad-clustering-summary__col-head'),
          dataIndex: col.key,
          key: col.key,
          className: 'pad-clustering-summary__col-head',
          onHeaderCell: () => ({
            className: 'pad-clustering-summary__col-head',
            ...(hasGroupedColumns ? { rowSpan: 2 } : {}),
          }),
          render: (value: string | undefined) => value ?? '—',
        };
      }

      return {
        title: col.label,
        key: `group-${col.label}`,
        className: 'pad-clustering-summary__col-group',
        onHeaderCell: () => ({ className: 'pad-clustering-summary__col-group' }),
        children: col.columns.map((child) => ({
          title: mkHeader(child.label, child.key, 'pad-clustering-summary__col-subhead'),
          dataIndex: child.key,
          key: child.key,
          className: 'pad-clustering-summary__col-subhead',
          onHeaderCell: () => ({ className: 'pad-clustering-summary__col-subhead' }),
          render: (value: string | undefined) => value ?? '—',
        })),
      };
    });

    return [labelColumn, ...metricColumns];
  }, [
    columnFilters,
    filterOptionsByKey,
    handleFilterChange,
    handleSort,
    hasGroupedColumns,
    rowHeaderLabel,
    sort,
    sortable,
    table.columns,
  ]);

  return (
    <section className="pad-clustering-summary__section">
      <h3 className="pad-clustering-summary__title">{title}</h3>
      {hasRows && table.rows.length > 1 ? (
        <div className="pad-clustering-summary__toolbar">
          <label className="pad-clustering-summary__search">
            <Search size={15} aria-hidden />
            <Input
              type="search"
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
              <Button
                size="small"
                className="pad-clustering-summary__reset"
                onClick={resetFilters}
              >
                Сбросить
              </Button>
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
          <AppDataTable<SummaryDataRow>
            className="pad-clustering-table text-xs pad-clustering-summary__table pad-clustering-summary__table--transposed"
            rowKey="key"
            columns={columns}
            dataSource={dataSource}
            emptyText="Нет строк по заданным фильтрам."
          />
        )}
      </div>
    </section>
  );
}
