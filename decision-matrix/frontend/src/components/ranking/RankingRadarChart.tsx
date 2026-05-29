import { useMemo } from 'react';
import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type { RankingMatrix, RankingAlternative } from '../../lib/api';
import { rankingAlternativeId } from '../../lib/rankingUtils';

const SERIES_COLORS = ['#2563eb', '#0d9488', '#7c3aed', '#ea580c'];

type Props = {
  matrix: RankingMatrix;
  alternatives: RankingAlternative[];
  selectedScenarioIds: string[];
};

export function RankingRadarChart({ matrix, alternatives, selectedScenarioIds }: Props) {
  const criteria = matrix.criteria;

  const alternativeIds = useMemo(() => {
    if (selectedScenarioIds.length > 0) {
      return selectedScenarioIds.slice(0, 4);
    }
    return [...alternatives]
      .sort((a, b) => a.rank - b.rank)
      .slice(0, 3)
      .map((a) => rankingAlternativeId(a))
      .filter(Boolean);
  }, [alternatives, selectedScenarioIds]);

  const chartData = useMemo(() => {
    return criteria.map((c) => {
      const row: Record<string, string | number> = { criterion: c.name };
      for (const id of alternativeIds) {
        const alt = alternatives.find((a) => rankingAlternativeId(a) === id);
        const label = alt?.name ?? id.slice(0, 8);
        row[label] = matrix.normalized_values[id]?.[c.id] ?? 0;
      }
      return row;
    });
  }, [criteria, alternativeIds, matrix.normalized_values, alternatives]);

  const seriesLabels = alternativeIds.map((id) => {
    const alt = alternatives.find((a) => rankingAlternativeId(a) === id);
    return alt?.name ?? id;
  });

  if (chartData.length === 0 || alternativeIds.length === 0) {
    return <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Недостаточно данных для radar.</p>;
  }

  return (
    <div className="ranking-chart-wrap ranking-radar-wrap">
      <ResponsiveContainer width="100%" height={320}>
        <RadarChart data={chartData} cx="50%" cy="50%" outerRadius="70%">
          <PolarGrid />
          <PolarAngleAxis dataKey="criterion" tick={{ fontSize: 11 }} />
          <PolarRadiusAxis angle={30} domain={[0, 1]} tick={false} />
          <Tooltip formatter={(v) => (typeof v === 'number' ? v.toFixed(3) : String(v))} />
          <Legend />
          {seriesLabels.map((label, i) => (
            <Radar
              key={label}
              name={label}
              dataKey={label}
              stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
              fill={SERIES_COLORS[i % SERIES_COLORS.length]}
              fillOpacity={0.2}
            />
          ))}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
