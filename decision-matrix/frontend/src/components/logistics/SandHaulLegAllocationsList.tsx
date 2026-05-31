import type { SandLogisticsConsumerRow } from '../../lib/api';
import { buildHaulLegRows, formatHaulLegKm, formatHaulLegM3 } from '../../lib/sandLogisticsHaulLegs';

/** Компактный список пропорциональных плеч возки для таблицы потребителей. */
export function SandHaulLegAllocationsList({ consumer }: { consumer: SandLogisticsConsumerRow }) {
  if (!consumer.in_service) {
    return <span className="text-[var(--text-muted)]">—</span>;
  }

  const rows = buildHaulLegRows(consumer);
  if (rows.length === 0) {
    return <span className="text-[var(--text-muted)]">—</span>;
  }

  return (
    <ul className="sand-haul-leg-alloc-list text-xs leading-snug space-y-0.5 m-0 p-0 list-none">
      {rows.map((row) => (
        <li key={row.quarry_id} className="tabular-nums">
          <span className="font-medium">{row.quarry_name || '—'}</span>
          {' · '}
          {formatHaulLegM3(row.allocated_m3)} м³
          {row.distance_km != null ? (
            <span className="text-[var(--text-muted)]"> · {formatHaulLegKm(row.distance_km)}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
