import { useMemo } from 'react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { rankColor } from '../../lib/rankingUtils';
import type { RankingAlternative } from '../../lib/api';
import { useIsMobile } from '../../hooks/useMediaQuery';

type Props = {
  alternatives: RankingAlternative[];
};

export function RankingBarChart({ alternatives }: Props) {
  const isMobile = useIsMobile();
  const chartData = useMemo(
    () =>
      [...alternatives]
        .sort((a, b) => a.rank - b.rank)
        .map((r) => ({ name: r.name, score: r.score, rank: r.rank })),
    [alternatives]
  );

  if (chartData.length === 0) {
    return <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Нет данных для графика.</p>;
  }

  return (
    <div className="ranking-chart-wrap">
      <ResponsiveContainer width="100%" height={isMobile ? 220 : 280}>
        <BarChart data={chartData} layout="vertical" margin={{ left: isMobile ? 8 : 80, right: 16 }}>
          <XAxis type="number" domain={[0, 1]} tickFormatter={(v) => `${(Number(v) * 100).toFixed(0)}%`} />
          <YAxis type="category" dataKey="name" width={isMobile ? 72 : 100} tick={{ fontSize: isMobile ? 11 : 12 }} />
          <Tooltip formatter={(v) => (typeof v === 'number' ? `${(v * 100).toFixed(1)}%` : String(v))} />
          <Bar dataKey="score" radius={4}>
            {chartData.map((entry) => (
              <Cell key={entry.name} fill={rankColor(entry.rank)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
