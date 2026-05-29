import { useEffect, useState } from 'react';
import { AppModal } from '../AppModal';
import { DeferredNumberInput } from '../DeferredNumberInput';
import { RANKING_DEFAULT_EXPERT, type RankingMatrix } from '../../lib/api';

type Props = {
  open: boolean;
  matrix: RankingMatrix;
  defaults: Record<string, number>;
  saving?: boolean;
  onClose: () => void;
  onApply: (values: Record<string, Record<string, number>>) => void;
};

function expertBounds(criterionId: string): { min: number; max: number } {
  if (criterionId === 'time_months') return { min: 1, max: 120 };
  return { min: 1, max: 10 };
}

export function RankingExpertMatrixModal({
  open,
  matrix,
  defaults,
  saving,
  onClose,
  onApply,
}: Props) {
  const userCriteria = matrix.criteria.filter((c) => c.value_source === 'user');
  const [local, setLocal] = useState<Record<string, Record<string, number>>>({});

  useEffect(() => {
    if (!open) return;
    const next: Record<string, Record<string, number>> = {};
    for (const sc of matrix.scenarios) {
      next[sc.id] = {};
      for (const c of userCriteria) {
        const effective = matrix.values[sc.id]?.[c.id];
        const defaultVal =
          defaults[c.id] ??
          RANKING_DEFAULT_EXPERT[c.id as keyof typeof RANKING_DEFAULT_EXPERT] ??
          0;
        next[sc.id][c.id] = effective ?? defaultVal;
      }
    }
    setLocal(next);
  }, [open, matrix, defaults, userCriteria]);

  if (!open || userCriteria.length === 0) return null;

  const patch = (scenarioId: string, criterionId: string, value: number) => {
    setLocal((prev) => ({
      ...prev,
      [scenarioId]: { ...prev[scenarioId], [criterionId]: value },
    }));
  };

  return (
    <AppModal
      title="Экспертные оценки по вариантам"
      titleId="ranking-expert-modal-title"
      onClose={onClose}
      size="lg"
      footer={
        <div className="flex gap-2 justify-end w-full">
          <button type="button" className="btn btn-secondary btn-sm" disabled={saving} onClick={onClose}>
            Отмена
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={saving}
            onClick={() => onApply(local)}
          >
            {saving ? 'Сохранение…' : 'Применить'}
          </button>
        </div>
      }
    >
      <div className="table-wrap">
        <table className="data-table ranking-expert-table">
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
            {userCriteria.map((c) => {
              const bounds = expertBounds(c.id);
              return (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  {matrix.scenarios.map((sc) => (
                    <td key={sc.id} className="col-center">
                      <DeferredNumberInput
                        value={local[sc.id]?.[c.id] ?? 0}
                        min={bounds.min}
                        max={bounds.max}
                        integer={c.id === 'time_months'}
                        className="ranking-expert-input"
                        onCommit={(v) => patch(sc.id, c.id, Number(v))}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AppModal>
  );
}
