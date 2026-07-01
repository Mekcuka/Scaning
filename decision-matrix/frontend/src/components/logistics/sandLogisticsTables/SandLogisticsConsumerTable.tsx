import { useMemo } from 'react';
import type { ColumnsType } from 'antd/es/table';
import type { SandLogisticsConsumerRow } from '../../../lib/api';
import { subtypeDisplayLabel } from '../../../lib/analysisDisplay';
import { formatEntryDateRu } from '../../../lib/infraEntryDate';
import { AppDataTable } from '../../AppDataTable';
import { sandConsumerTableExportColumns } from '../../../lib/tableExcelExportData';
import { SandHaulLegAllocationsList } from '../SandHaulLegAllocationsList';
import { fmtKm, fmtM3, formatAllocationByYear } from './formatters';

export function SandLogisticsConsumerTable({ rows }: { rows: SandLogisticsConsumerRow[] }) {
  const columns = useMemo<ColumnsType<SandLogisticsConsumerRow>>(
    () => [
      {
        title: 'Объект',
        key: 'name',
        render: (_, row) => (
          <span className="font-medium">
            {row.name || subtypeDisplayLabel(row.subtype)}
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
        title: 'Спрос, м³',
        key: 'demand_m3',
        align: 'right',
        className: 'tabular-nums',
        onCell: (row) => {
          const planTotal = row.demand_plan_total_m3 ?? row.demand_m3;
          const demandTitle =
            planTotal > row.demand_m3
              ? `На дату расчёта учтено ${fmtM3(row.demand_m3)} из ${fmtM3(planTotal)} м³ плана`
              : undefined;
          return { title: demandTitle };
        },
        render: (_, row) => fmtM3(row.demand_m3),
      },
      {
        title: 'км до карьера',
        key: 'distance_km',
        className: 'tabular-nums text-[var(--text-muted)]',
        render: (_, row) => fmtKm(row.distance_km),
      },
      {
        title: 'Карьер (жадный)',
        key: 'greedy_quarry_name',
        render: (_, row) => row.greedy_quarry_name ?? '—',
      },
      {
        title: 'Выделено, м³',
        key: 'greedy_allocated_m3',
        align: 'right',
        className: 'tabular-nums',
        render: (_, row) => fmtM3(row.greedy_allocated_m3),
      },
      {
        title: 'По годам (отгрузка)',
        key: 'allocation_by_year',
        className: 'text-xs text-[var(--text-muted)] max-w-[12rem]',
        render: (_, row) => {
          const byYearLabel = formatAllocationByYear(row.allocation_by_year_m3);
          return byYearLabel ?? '—';
        },
      },
      {
        title: 'Плечо возки (пропорц.)',
        key: 'haul_legs',
        className: 'align-top min-w-[10rem]',
        render: (_, row) => <SandHaulLegAllocationsList consumer={row} />,
      },
    ],
    [],
  );

  if (rows.length === 0) {
    return (
      <p className="text-sm text-[var(--text-muted)]">Нет потребителей с объёмом спроса на карте.</p>
    );
  }

  return (
    <AppDataTable
      className="w-full text-sm"
      rowKey="object_id"
      columns={columns}
      dataSource={rows}
      onRow={(row) => {
        const planTotal = row.demand_plan_total_m3 ?? row.demand_m3;
        const demandTitle =
          planTotal > row.demand_m3
            ? `На дату расчёта учтено ${fmtM3(row.demand_m3)} из ${fmtM3(planTotal)} м³ плана`
            : undefined;
        return {
          className: !row.in_service ? 'opacity-60' : undefined,
          title: !row.in_service ? 'Объект ещё не введён в эксплуатацию' : demandTitle,
        };
      }}
      excelExport={{
        filename: 'potoki-logistika-potrebiteli.xlsx',
        sheetName: 'Потребители',
        columns: sandConsumerTableExportColumns(),
        rows,
      }}
    />
  );
}
