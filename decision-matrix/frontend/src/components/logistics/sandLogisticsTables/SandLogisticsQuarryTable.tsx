import type { SandLogisticsQuarryRow } from '../../../lib/api';
import { formatEntryDateRu } from '../../../lib/infraEntryDate';
import {
  TableExcelExportBodyCell,
  TableExcelExportButton,
} from '../../TableExcelExportButton';
import { sandQuarryTableExportColumns } from '../../../lib/tableExcelExportData';
import { fmtM3 } from './formatters';

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
