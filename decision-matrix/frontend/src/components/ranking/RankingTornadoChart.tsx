import { useMemo } from 'react';
import type { RankingSensitivityResult } from '../../lib/api';

type Props = {
  data: RankingSensitivityResult;
  criterionName: string;
};

export function RankingTornadoChart({ data, criterionName }: Props) {
  const rows = useMemo(() => {
    const leaderByDelta = data.points.map((pt) => {
      const sorted = [...pt.alternatives].sort((a, b) => a.rank - b.rank);
      return { delta: pt.delta, leader: sorted[0]?.name ?? '—', rank: sorted[0]?.rank ?? 0 };
    });
    const changes = new Set(leaderByDelta.map((r) => r.leader)).size;
    const base = leaderByDelta.find((r) => r.delta === 0);
    return { leaderByDelta, changes, baseLeader: base?.leader ?? '—' };
  }, [data]);

  return (
    <div className="ranking-tornado">
      <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
        Критерий: <strong>{criterionName}</strong>. Лидер при базовых весах: {rows.baseLeader}.
        {rows.changes > 1 && ' При изменении веса возможна смена лидера.'}
      </p>
      {data.points.map((pt) => {
        const sorted = [...pt.alternatives].sort((a, b) => a.rank - b.rank);
        const leader = sorted[0];
        const scoreShare = leader ? leader.score : 0;
        const left = Math.round((1 - scoreShare) * 50);
        const right = 100 - left;
        return (
          <div key={pt.delta} className="tornado-row">
            <span className="tornado-row__label tabular">
              {pt.delta >= 0 ? '+' : ''}
              {(pt.delta * 100).toFixed(0)}%
            </span>
            <div className="tornado-row__bars">
              <div className="tornado-left" style={{ width: `${left}%` }} />
              <div className="tornado-right" style={{ width: `${right}%` }} />
            </div>
            <span className="tornado-row__leader">{leader?.name ?? '—'}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Build tornado summary across all criteria (rank stability). */
export function RankingTornadoOverview({
  items,
}: {
  items: { criterionId: string; criterionName: string; data: RankingSensitivityResult }[];
}) {
  return (
    <div className="ranking-tornado-overview">
      {items.map(({ criterionId, criterionName, data }) => {
        const leaders = new Set(
          data.points.map((pt) => [...pt.alternatives].sort((a, b) => a.rank - b.rank)[0]?.name)
        );
        const unstable = leaders.size > 1;
        const left = unstable ? 35 : 20;
        const right = 100 - left;
        return (
          <div key={criterionId} className="tornado-row">
            <span className="tornado-row__label">{criterionName}</span>
            <div className="tornado-row__bars">
              <div className="tornado-left" style={{ width: `${left}%` }} />
              <div className="tornado-right" style={{ width: `${right}%` }} />
            </div>
            <span className="tornado-row__leader" style={{ color: unstable ? 'var(--warning)' : 'var(--text-muted)' }}>
              {unstable ? 'Нестабильно' : 'Стабильно'}
            </span>
          </div>
        );
      })}
    </div>
  );
}
