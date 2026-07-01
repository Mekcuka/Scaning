import { useMemo } from 'react';
import type { ColumnsType } from 'antd/es/table';
import { ProjectLink } from '../../components/ProjectLink';
import { AppDataTable } from '../../components/AppDataTable';
import type { SandLogisticsResult } from '../../lib/api';
import { formatEntryDateRu } from '../../lib/infraEntryDate';
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
  asOf?: string;
  /** Компактный вид для боковой панели на карте */
  compact?: boolean;
};

export function SandHaulLegTable({ objectId, sandLogistics, asOf, compact = false }: Props) {
  const consumer = findSandLogisticsConsumer(sandLogistics, objectId);
  const warnings = consumerSandLogisticsWarnings(sandLogistics, objectId);

  const columns = useMemo<ColumnsType<SandHaulLegRow>>(
    () => [
      {
        title: 'Карьер',
        key: 'quarry',
        render: (_, row) => (
          <span className={compact ? 'sand-haul-leg-table__name' : 'font-medium'}>
            {row.quarry_name || '—'}
          </span>
        ),
      },
      {
        title: compact ? 'м³' : 'Объём, м³',
        key: 'volume',
        align: 'right',
        className: 'tabular-nums',
        render: (_, row) => formatHaulLegM3(row.allocated_m3),
      },
      {
        title: compact ? 'км' : 'Расстояние, км',
        key: 'distance',
        align: 'right',
        className: 'tabular-nums text-[var(--text-muted)]',
        render: (_, row) => formatHaulLegKm(row.distance_km),
      },
    ],
    [compact],
  );

  const hintClass = compact
    ? 'text-xs object-detail-panel__hint leading-snug'
    : 'text-sm object-detail-panel__hint';

  if (!sandLogistics) {
    return (
      <p className={hintClass}>
        Выполните расчёт логистики на вкладке{' '}
        <ProjectLink to="/logistics/schematic" className="text-[var(--primary)] hover:underline">
          Потоки → Логистика
        </ProjectLink>
        .
      </p>
    );
  }

  if (!consumer) {
    return (
      <p className={hintClass}>
        Объект не найден в результатах расчёта. Проверьте подключение к сети автодорог и
        повторите расчёт на{' '}
        <ProjectLink to="/logistics/schematic" className="text-[var(--primary)] hover:underline">
          Потоки → Логистика
        </ProjectLink>
        .
      </p>
    );
  }

  if (!consumer.in_service) {
    return (
      <p className={hintClass}>
        Объект ещё не введён в эксплуатацию — плечи возки не рассчитываются.
      </p>
    );
  }

  const rows = buildHaulLegRows(consumer);

  if (rows.length === 0) {
    return (
      <div className={compact ? 'space-y-1' : 'space-y-2'}>
        {warnings.length > 0 && (
          <ul className={`${compact ? 'text-xs' : 'text-sm'} text-amber-600 list-disc pl-3`}>
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}
        <p className={hintClass}>Нет плеч возки (нет пути к карьеру или нулевой спрос).</p>
      </div>
    );
  }

  return (
    <div className={compact ? 'space-y-1' : 'space-y-2'}>
      {warnings.length > 0 && (
        <ul className={`${compact ? 'text-xs' : 'text-sm'} text-amber-600 list-disc pl-3`}>
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
      <AppDataTable
        className={compact ? 'sand-haul-leg-table' : 'w-full text-sm'}
        rowKey="quarry_id"
        columns={columns}
        dataSource={rows}
      />
      {asOf ? (
        <p
          className={
            compact
              ? 'text-[0.65rem] object-detail-panel__hint leading-tight'
              : 'text-xs object-detail-panel__hint'
          }
        >
          {compact
            ? `Расчёт от ${formatEntryDateRu(asOf)}`
            : `Данные расчёта от ${formatEntryDateRu(asOf)}`}
        </p>
      ) : null}
    </div>
  );
}
