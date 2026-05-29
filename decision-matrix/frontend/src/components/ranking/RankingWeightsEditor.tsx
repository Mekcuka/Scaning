import { useState } from 'react';
import { formatWeight, weightsSum } from '../../lib/rankingUtils';
import type { RankingCriterion } from '../../lib/api';
import { useRankingContext } from '../../pages/ranking/rankingContext';
import { RankingWeightsModal } from './RankingWeightsModal';

type Props = {
  criteria: RankingCriterion[];
  weights: Record<string, number>;
};

export function RankingWeightsEditor({ criteria, weights }: Props) {
  const { updateSettings, calculate, settingsSaving } = useRankingContext();
  const [modalOpen, setModalOpen] = useState(false);

  const sum = weightsSum(weights);
  const sumOk = Math.abs(sum - 1) <= 0.001;

  const handleApply = async (next: Record<string, number>) => {
    await updateSettings({ weights: next });
    calculate();
    setModalOpen(false);
  };

  return (
    <div className="ranking-weights">
      <div className="ranking-weights__sum" data-ok={sumOk}>
        Сумма весов: <span className="tabular font-semibold">{formatWeight(sum)}</span>
        {!sumOk && <span className="ranking-weights__warn"> (должна быть 1.000)</span>}
      </div>
      <div className="table-wrap">
        <table className="data-table ranking-weights-table">
          <thead>
            <tr>
              <th>Критерий</th>
              <th>Тип</th>
              <th>Вес</th>
            </tr>
          </thead>
          <tbody>
            {criteria.map((c) => {
              const w = weights[c.id] ?? 0;
              return (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td style={{ color: 'var(--text-muted)' }}>
                    {c.type === 'benefit' ? 'Максимизация' : 'Минимизация'}
                  </td>
                  <td className="tabular">{formatWeight(w)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        className="btn btn-secondary btn-sm mt-3"
        disabled={settingsSaving}
        onClick={() => setModalOpen(true)}
      >
        Настроить веса…
      </button>

      <RankingWeightsModal
        open={modalOpen}
        criteria={criteria}
        weights={weights}
        saving={settingsSaving}
        onClose={() => setModalOpen(false)}
        onApply={handleApply}
      />
    </div>
  );
}
