import type { RankingMatrix } from '../../lib/api';

type Props = {
  matrix: RankingMatrix;
};

export function RankingComputedMatrix({ matrix }: Props) {
  const computed = matrix.criteria.filter((c) => c.value_source !== 'user');
  if (computed.length === 0) return null;

  const formatVal = (criterionId: string, val: number) => {
    if (criterionId === 'total_cost_mln') return `${val.toFixed(2)} млн ₽`;
    if (criterionId === 'total_distance_km') return `${val.toFixed(1)} км`;
    if (criterionId === 'exceed_count') return String(Math.round(val));
    return val.toFixed(2);
  };

  return (
    <div className="ranking-computed-matrix">
      <h3 className="font-semibold mb-2">Автоматические критерии (из анализа)</h3>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Критерий</th>
              {matrix.scenarios.map((sc) => (
                <th key={sc.id} className="col-center">
                  {sc.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {computed.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                {matrix.scenarios.map((sc) => (
                  <td key={sc.id} className="tabular col-center" style={{ color: 'var(--text-muted)' }}>
                    {formatVal(c.id, matrix.values[sc.id]?.[c.id] ?? 0)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
