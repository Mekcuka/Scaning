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

export type SandHaulLegColumn = 'quarry' | 'volume' | 'distance';

const hintClass = 'parameters-haul-leg-hint text-xs';

export function renderSandHaulLegCell(
  objectId: string,
  sandLogistics: SandLogisticsResult | null | undefined,
  column: SandHaulLegColumn,
): ReactNode {
  const consumer = findSandLogisticsConsumer(sandLogistics, objectId);
  const warnings = consumerSandLogisticsWarnings(sandLogistics, objectId);

  if (!sandLogistics) {
    if (column === 'quarry') {
      return (
        <span className={hintClass}>
          <ProjectLink to="/logistics/schematic" className="text-[var(--primary)] hover:underline">
            Расчёт
          </ProjectLink>
        </span>
      );
    }
    return <span className="text-[var(--text-muted)]">—</span>;
  }

  if (!consumer) {
    return <span className="text-[var(--text-muted)]">—</span>;
  }

  if (!consumer.in_service) {
    if (column === 'quarry') {
      return (
        <span className="parameters-haul-leg-hint text-xs text-amber-600" title="Не введён в эксплуатацию">
          не введён
        </span>
      );
    }
    return <span className="text-[var(--text-muted)]">—</span>;
  }

  const rows = buildHaulLegRows(consumer);

  if (rows.length === 0) {
    const warn = warnings[0];
    if (column === 'quarry') {
      return (
        <span className={hintClass} title={warn ?? 'Нет пути к карьеру или нулевой спрос'}>
          {warn ? '⚠' : '—'}
        </span>
      );
    }
    return <span className="text-[var(--text-muted)]">—</span>;
  }

  if (column === 'quarry') {
    return (
      <HaulLegValueList
        rows={rows}
        render={(row) => <span className="font-medium">{row.quarry_name || '—'}</span>}
      />
    );
  }
  if (column === 'volume') {
    return (
      <span className="tabular-nums">
        <HaulLegValueList rows={rows} render={(row) => formatHaulLegM3(row.allocated_m3)} />
      </span>
    );
  }
  return (
    <span className="tabular-nums text-[var(--text-muted)]">
      <HaulLegValueList rows={rows} render={(row) => formatHaulLegKm(row.distance_km)} />
    </span>
  );
}

