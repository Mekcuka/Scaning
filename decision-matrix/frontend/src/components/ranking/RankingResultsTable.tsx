import { RANK_MEDAL_CLASS, rankColor, rankingAlternativeId, scenarioTypeLabel } from '../../lib/rankingUtils';
import type { RankingAlternative } from '../../lib/api';

type Props = {
  alternatives: RankingAlternative[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onRowClick?: (id: string) => void;
  highlightId?: string | null;
  unit?: 'poi' | 'scenario';
};

export function RankingResultsTable({
  alternatives,
  selectedIds,
  onToggleSelect,
  onRowClick,
  highlightId,
  unit = 'scenario',
}: Props) {
  const sorted = [...alternatives].sort((a, b) => a.rank - b.rank);
  const leaderScore = sorted[0]?.score ?? 1;
  const isPoi = unit === 'poi';

  return (
    <div className="table-wrap">
      <table className="data-table ranking-results-table">
        <thead>
          <tr>
            <th className="col-check" />
            <th>Место</th>
            <th>{isPoi ? 'Точка интереса' : 'Сценарий'}</th>
            {!isPoi && <th>Тип</th>}
            <th className="col-center">Балл</th>
            <th className="col-center">% лидера</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const id = rankingAlternativeId(r);
            const medal = RANK_MEDAL_CLASS[r.rank];
            const pct = leaderScore > 0 ? (r.score / leaderScore) * 100 : 0;
            const selected = selectedIds.includes(id);
            const highlighted = highlightId === id;
            return (
              <tr
                key={id}
                className={highlighted ? 'ranking-results-row--active' : undefined}
                onClick={() => onRowClick?.(id)}
                style={{ cursor: onRowClick ? 'pointer' : undefined }}
              >
                <td className="col-check" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected}
                    disabled={!selected && selectedIds.length >= 2}
                    aria-label={`Сравнить ${r.name}`}
                    onChange={() => onToggleSelect(id)}
                  />
                </td>
                <td>
                  <span
                    className={`rank-medal ${medal ?? ''}`}
                    style={!medal ? { background: 'var(--surface-3)' } : undefined}
                  >
                    {r.rank}
                  </span>
                </td>
                <td className="font-medium">{r.name}</td>
                {!isPoi && (
                  <td style={{ color: 'var(--text-muted)' }}>{scenarioTypeLabel(r.scenario_type)}</td>
                )}
                <td className="tabular col-center font-mono">{r.score.toFixed(4)}</td>
                <td className="tabular col-center" style={{ color: rankColor(r.rank) }}>
                  {pct.toFixed(0)}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
