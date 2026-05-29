import { useEffect, useState } from 'react';
import { AppModal } from '../AppModal';
import { formatWeight, rebalanceRankingWeights, weightsSum } from '../../lib/rankingUtils';
import type { RankingCriterion } from '../../lib/api';

type Props = {
  open: boolean;
  criteria: RankingCriterion[];
  weights: Record<string, number>;
  saving?: boolean;
  onClose: () => void;
  onApply: (weights: Record<string, number>) => void;
};

export function RankingWeightsModal({
  open,
  criteria,
  weights,
  saving,
  onClose,
  onApply,
}: Props) {
  const [local, setLocal] = useState(weights);

  useEffect(() => {
    if (open) setLocal(weights);
  }, [open, weights]);

  if (!open) return null;

  const onSlider = (criterionId: string, pct: number) => {
    const delta = pct / 100 - (local[criterionId] ?? 0);
    setLocal(rebalanceRankingWeights(local, criterionId, delta));
  };

  const sum = weightsSum(local);
  const sumOk = Math.abs(sum - 1) <= 0.001;

  return (
    <AppModal
      title="Настройка весов критериев"
      titleId="ranking-weights-modal-title"
      onClose={onClose}
      size="lg"
      footer={
        <div className="flex gap-2 justify-end w-full flex-wrap">
          <button type="button" className="btn btn-secondary btn-sm" disabled={saving} onClick={onClose}>
            Отмена
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={saving || !sumOk}
            onClick={() => onApply(local)}
          >
            {saving ? 'Сохранение…' : 'Применить'}
          </button>
        </div>
      }
    >
      <div className="ranking-weights__sum mb-3" data-ok={sumOk}>
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
              <th className="col-slider">Слайдер</th>
            </tr>
          </thead>
          <tbody>
            {criteria.map((c) => {
              const w = local[c.id] ?? 0;
              return (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td style={{ color: 'var(--text-muted)' }}>
                    {c.type === 'benefit' ? 'Максимизация' : 'Минимизация'}
                  </td>
                  <td className="tabular">{formatWeight(w)}</td>
                  <td className="col-slider">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={Math.round(w * 100)}
                      className="ranking-weights-slider"
                      aria-label={`Вес ${c.name}`}
                      onChange={(e) => onSlider(c.id, Number(e.target.value))}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
        Перетащите слайдеры и нажмите «Применить» — веса сохранятся и ранжирование пересчитается.
      </p>
    </AppModal>
  );
}
