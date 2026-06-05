import type { SandLogisticsConsumerRow } from '../../../lib/api';
import { subtypeDisplayLabel } from '../../../lib/analysisDisplay';
import { formatEntryDateRu } from '../../../lib/infraEntryDate';
import {
  TableExcelExportBodyCell,
  TableExcelExportButton,
} from '../../TableExcelExportButton';
import { sandConsumerTableExportColumns } from '../../../lib/tableExcelExportData';
import { SandHaulLegAllocationsList } from '../SandHaulLegAllocationsList';
import { fmtKm, fmtM3, formatAllocationByYear } from './formatters';

export function SandLogisticsConsumerTable({ rows }: { rows: SandLogisticsConsumerRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-[var(--text-muted)]">Нет потребителей с объёмом спроса на карте.</p>;
  }

  return (
    <div className="table-wrap">
      <table className="data-table w-full text-sm">
        <thead>
          <tr>
            <th>Объект</th>
            <th>Дата ввода</th>
            <th className="text-right">Спрос, м³</th>
            <th>км до карьера</th>
            <th>Карьер (жадный)</th>
            <th className="text-right">Выделено, м³</th>
            <th>По годам (отгрузка)</th>
            <th>Плечо возки (пропорц.)</th>
            <th className="table-excel-export-th">
              <TableExcelExportButton
                filename="potoki-logistika-potrebiteli.xlsx"
                sheetName="Потребители"
                columns={sandConsumerTableExportColumns()}
                rows={rows}
              />
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const planTotal = row.demand_plan_total_m3 ?? row.demand_m3;
            const demandTitle =
              planTotal > row.demand_m3
                ? `На дату расчёта учтено ${fmtM3(row.demand_m3)} из ${fmtM3(planTotal)} м³ плана`
                : undefined;
            const byYearLabel = formatAllocationByYear(row.allocation_by_year_m3);
            return (
              <tr
                key={row.object_id}
                className={!row.in_service ? 'opacity-60' : undefined}
                title={
                  !row.in_service
                    ? 'Объект ещё не введён в эксплуатацию'
                    : demandTitle
                }
              >
                <td className="font-medium">
                  {row.name || subtypeDisplayLabel(row.subtype)}
                  {!row.in_service ? ' (не введён)' : ''}
                </td>
                <td className="tabular-nums text-[var(--text-muted)]">
                  {formatEntryDateRu(row.entry_date)}
                </td>
                <td className="text-right tabular-nums" title={demandTitle}>
                  {fmtM3(row.demand_m3)}
                </td>
                <td className="tabular-nums text-[var(--text-muted)]">
                  {fmtKm(row.distance_km)}
                </td>
                <td>{row.greedy_quarry_name ?? '—'}</td>
                <td className="text-right tabular-nums">{fmtM3(row.greedy_allocated_m3)}</td>
                <td
                  className="text-xs text-[var(--text-muted)] max-w-[12rem]"
                  title={byYearLabel ?? undefined}
                >
                  {byYearLabel ?? '—'}
                </td>
                <td className="align-top min-w-[10rem]">
                  <SandHaulLegAllocationsList consumer={row} />
                </td>
                <TableExcelExportBodyCell />
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
