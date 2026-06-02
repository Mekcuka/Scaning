import type { SandLogisticsConsumerRow, SandLogisticsQuarryRow } from '../../lib/api';
import { subtypeDisplayLabel } from '../../lib/analysisDisplay';
import { formatEntryDateRu } from '../../lib/infraEntryDate';
import {
  TableExcelExportBodyCell,
  TableExcelExportButton,
} from '../TableExcelExportButton';
import {
  sandConsumerTableExportColumns,
  sandQuarryTableExportColumns,
} from '../../lib/tableExcelExportData';
import { SandHaulLegAllocationsList } from './SandHaulLegAllocationsList';

function fmtKm(km: number | null | undefined): string {
  if (km == null) return '—';
  return `${km.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} км`;
}

function fmtM3(v: number | null | undefined): string {
  if (v == null) return '—';
  return v.toLocaleString('ru-RU', { maximumFractionDigits: 1 });
}

function formatAllocationByYear(allocation: Record<string, number> | undefined): string | null {
  if (!allocation || Object.keys(allocation).length === 0) return null;
  return Object.entries(allocation)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([y, v]) => `${y}: ${v.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} м³`)
    .join('; ');
}

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

export function SandLogisticsQuarryTable({ rows }: { rows: SandLogisticsQuarryRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-[var(--text-muted)]">Нет карьеров песка на карте.</p>;
  }

  return (
    <div className="table-wrap">
      <table className="data-table w-full text-sm">
        <thead>
          <tr>
            <th>Карьер</th>
            <th>Дата ввода</th>
            <th className="text-right">Начальный, м³</th>
            <th className="text-right">Текущий, м³</th>
            <th className="text-right">Отгружено (жадный)</th>
            <th className="text-right">Остаток</th>
            <th className="text-right">Пропорц., м³</th>
            <th className="table-excel-export-th">
              <TableExcelExportButton
                filename="potoki-logistika-karery.xlsx"
                sheetName="Карьеры"
                columns={sandQuarryTableExportColumns()}
                rows={rows}
              />
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.object_id}
              className={!row.in_service ? 'opacity-60' : undefined}
              title={!row.in_service ? 'Карьер ещё не введён в эксплуатацию' : undefined}
            >
              <td className="font-medium">
                {row.name}
                {!row.in_service ? ' (не введён)' : ''}
              </td>
              <td className="tabular-nums text-[var(--text-muted)]">
                {formatEntryDateRu(row.entry_date)}
              </td>
              <td className="text-right tabular-nums">{fmtM3(row.initial_m3)}</td>
              <td className="text-right tabular-nums">{fmtM3(row.current_m3)}</td>
              <td className="text-right tabular-nums">{fmtM3(row.greedy_allocated_m3)}</td>
              <td className="text-right tabular-nums">{fmtM3(row.greedy_remaining_m3)}</td>
              <td
                className={`text-right tabular-nums ${
                  row.proportional_exceeds_capacity ? 'text-[var(--danger)] font-medium' : ''
                }`}
                title={
                  row.proportional_exceeds_capacity
                    ? 'Пропорциональное распределение превышает текущий объём карьера'
                    : undefined
                }
              >
                {fmtM3(row.proportional_allocated_m3)}
                {row.proportional_exceeds_capacity ? ' ⚠' : ''}
              </td>
              <TableExcelExportBodyCell />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
