import type { ReactNode } from 'react';
import { ProjectLink } from '../ProjectLink';
import type { SandLogisticsResult } from '../../lib/api';
import {
  buildHaulLegRows,
  consumerSandLogisticsWarnings,
  findSandLogisticsConsumer,
  formatHaulLegKm,
  formatHaulLegM3,
  type SandHaulLegRow,
} from '../../lib/sandLogisticsHaulLegs';

type Props = {
  objectId: string;
  sandLogistics: SandLogisticsResult | null | undefined;
};

const hintClass = 'parameters-haul-leg-hint text-xs text-[var(--text-muted)]';

function HaulLegValueList({
  rows,
  render,
  className = '',
}: {
  rows: SandHaulLegRow[];
  render: (row: SandHaulLegRow) => ReactNode;
  className?: string;
}) {
  if (rows.length === 0) {
    return <span className="text-[var(--text-muted)]">—</span>;
  }
  if (rows.length === 1) {
    return <span className={className}>{render(rows[0]!)}</span>;
  }
  return (
    <ul className="sand-haul-leg-alloc-list text-xs leading-snug space-y-0.5 m-0 p-0 list-none">
      {rows.map((row) => (
        <li key={row.quarry_id} className={className}>
          {render(row)}
        </li>
      ))}
    </ul>
  );
}

/** Три ячейки таблицы параметров: карьер, объём, расстояние. */
export function SandHaulLegParameterCells({ objectId, sandLogistics }: Props) {
  const consumer = findSandLogisticsConsumer(sandLogistics, objectId);
  const warnings = consumerSandLogisticsWarnings(sandLogistics, objectId);

  if (!sandLogistics) {
    return (
      <>
        <td className="parameters-table__haul-cell align-top" colSpan={3}>
          <span className={hintClass}>
            <ProjectLink to="/flows/logistics" className="text-[var(--primary)] hover:underline">
              Расчёт
            </ProjectLink>
          </span>
        </td>
      </>
    );
  }

  if (!consumer) {
    return (
      <>
        <td className="parameters-table__haul-cell align-top">—</td>
        <td className="parameters-table__haul-cell align-top tabular-nums">—</td>
        <td className="parameters-table__haul-cell align-top tabular-nums text-[var(--text-muted)]">
          —
        </td>
      </>
    );
  }

  if (!consumer.in_service) {
    return (
      <>
        <td className="parameters-table__haul-cell align-top">
          <span className="parameters-haul-leg-hint text-xs text-amber-600" title="Не введён в эксплуатацию">
            не введён
          </span>
        </td>
        <td className="parameters-table__haul-cell align-top tabular-nums">—</td>
        <td className="parameters-table__haul-cell align-top tabular-nums text-[var(--text-muted)]">
          —
        </td>
      </>
    );
  }

  const rows = buildHaulLegRows(consumer);

  if (rows.length === 0) {
    const warn = warnings[0];
    return (
      <>
        <td className="parameters-table__haul-cell align-top">
          <span className={hintClass} title={warn ?? 'Нет пути к карьеру или нулевой спрос'}>
            {warn ? '⚠' : '—'}
          </span>
        </td>
        <td className="parameters-table__haul-cell align-top tabular-nums">—</td>
        <td className="parameters-table__haul-cell align-top tabular-nums text-[var(--text-muted)]">
          —
        </td>
      </>
    );
  }

  return (
    <>
      <td className="parameters-table__haul-cell align-top">
        <HaulLegValueList
          rows={rows}
          render={(row) => <span className="font-medium">{row.quarry_name || '—'}</span>}
        />
      </td>
      <td className="parameters-table__haul-cell align-top tabular-nums">
        <HaulLegValueList rows={rows} render={(row) => formatHaulLegM3(row.allocated_m3)} />
      </td>
      <td className="parameters-table__haul-cell align-top tabular-nums text-[var(--text-muted)]">
        <HaulLegValueList rows={rows} render={(row) => formatHaulLegKm(row.distance_km)} />
      </td>
    </>
  );
}
