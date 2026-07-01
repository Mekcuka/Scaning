import { useMemo } from 'react';
import type { ColumnsType } from 'antd/es/table';
import type { SandLogisticsQuarryRow } from '../../../lib/api';
import { formatEntryDateRu } from '../../../lib/infraEntryDate';
import { AppDataTable } from '../../AppDataTable';
import { sandQuarryTableExportColumns } from '../../../lib/tableExcelExportData';
import { fmtM3 } from './formatters';

export function SandLogisticsQuarryTable({ rows }: { rows: SandLogisticsQuarryRow[] }) {
  const columns = useMemo<ColumnsType<SandLogisticsQuarryRow>>(
    () => [
      {
        title: 'Карьер',
        key: 'name',
        render: (_, row) => (
          <span className="font-medium">
            {row.name}
            {!row.in_service ? ' (не введён)' : ''}
          </span>
        ),
      },
      {
        title: 'Дата ввода',
        key: 'entry_date',
        className: 'tabular-nums text-[var(--text-muted)]',
        render: (_, row) => formatEntryDateRu(row.entry_date),
      },
      {
        title: 'Начальный, м³',
        key: 'initial_m3',
        align: 'right',
        className: 'tabular-nums',
        render: (_, row) => fmtM3(row.initial_m3),
      },
      {
        title: 'Текущий, м³',
        key: 'current_m3',
        align: 'right',
        className: 'tabular-nums',
        render: (_, row) => fmtM3(row.current_m3),
      },
      {
        title: 'Отгружено (жадный)',
        key: 'greedy_allocated_m3',
        align: 'right',
        className: 'tabular-nums',
        render: (_, row) => fmtM3(row.greedy_allocated_m3),
      },
      {
        title: 'Остаток',
        key: 'greedy_remaining_m3',
        align: 'right',
        className: 'tabular-nums',
        render: (_, row) => fmtM3(row.greedy_remaining_m3),
      },
      {
        title: 'Пропорц., м³',
        key: 'proportional_allocated_m3',
        align: 'right',
        className: 'tabular-nums',
        onCell: (row) => ({
          className: row.proportional_exceeds_capacity ? 'text-[var(--danger)] font-medium' : '',
          title: row.proportional_exceeds_capacity
            ? 'Пропорциональное распределение превышает текущий объём карьера'
            : undefined,
        }),
        render: (_, row) => (
          <>
            {fmtM3(row.proportional_allocated_m3)}
            {row.proportional_exceeds_capacity ? ' ⚠' : ''}
          </>
        ),
      },
    ],
    [],
  );

  if (rows.length === 0) {
    return <p className="text-sm text-[var(--text-muted)]">Нет карьеров песка на карте.</p>;
  }

  return (
    <AppDataTable
      className="w-full text-sm"
      rowKey="object_id"
      columns={columns}
      dataSource={rows}
      onRow={(row) => ({
        className: !row.in_service ? 'opacity-60' : undefined,
        title: !row.in_service ? 'Карьер ещё не введён в эксплуатацию' : undefined,
      })}
      excelExport={{
        filename: 'potoki-logistika-karery.xlsx',
        sheetName: 'Карьеры',
        columns: sandQuarryTableExportColumns(),
        rows,
      }}
    />
  );
}
