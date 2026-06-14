import { ProjectLink } from '../../components/ProjectLink';
import type { SandLogisticsResult } from '../../lib/api';
import { formatEntryDateRu } from '../../lib/infraEntryDate';
import {
  buildHaulLegRows,
  consumerSandLogisticsWarnings,
  findSandLogisticsConsumer,
  formatHaulLegKm,
  formatHaulLegM3,
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

  const hintClass = compact
    ? 'text-xs object-detail-panel__hint leading-snug'
    : 'text-sm object-detail-panel__hint';

  if (!sandLogistics) {
    return (
      <p className={hintClass}>
        Выполните расчёт логистики на вкладке{' '}
        <ProjectLink to="/flows/logistics" className="text-[var(--primary)] hover:underline">
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
        <ProjectLink to="/flows/logistics" className="text-[var(--primary)] hover:underline">
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
      <div className={compact ? 'sand-haul-leg-table-wrap' : 'table-wrap'}>
        <table className={compact ? 'sand-haul-leg-table' : 'data-table w-full text-sm'}>
          <thead>
            <tr>
              <th>Карьер</th>
              <th className="text-right">{compact ? 'м³' : 'Объём, м³'}</th>
              <th className="text-right">{compact ? 'км' : 'Расстояние, км'}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.quarry_id}>
                <td className={compact ? 'sand-haul-leg-table__name' : 'font-medium'}>
                  {row.quarry_name || '—'}
                </td>
                <td className="text-right tabular-nums">{formatHaulLegM3(row.allocated_m3)}</td>
                <td className="text-right tabular-nums text-[var(--text-muted)]">
                  {formatHaulLegKm(row.distance_km)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
