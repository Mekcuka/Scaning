import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, RANKING_DEFAULT_EXPERT, type RankingMatrix } from '../../lib/api';
import { useRankingContext } from '../../pages/ranking/rankingContext';
import { useAppStore } from '../../store';
import { RankingExpertMatrixModal } from './RankingExpertMatrixModal';

type Props = {
  matrix: RankingMatrix;
};

export function RankingExpertMatrix({ matrix }: Props) {
  const { projectId, activePoiId, rankingSettings, calculate, settingsSaving } = useRankingContext();
  const pushToast = useAppStore((s) => s.pushToast);
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);

  const userCriteria = matrix.criteria.filter((c) => c.value_source === 'user');
  const defaults = rankingSettings?.default_expert_values ?? RANKING_DEFAULT_EXPERT;

  const saveMut = useMutation({
    mutationFn: (payload: Record<string, Record<string, number>>) =>
      api.updatePoiRankingCriterionValues(projectId!, activePoiId, payload),
    onSuccess: (_data, payload) => {
      queryClient.setQueryData<RankingMatrix>(
        ['ranking-matrix', projectId, activePoiId],
        (prev) => {
          if (!prev) return prev;
          const values = { ...prev.values };
          for (const [scenarioId, criterionMap] of Object.entries(payload)) {
            values[scenarioId] = { ...values[scenarioId], ...criterionMap };
          }
          return { ...prev, values };
        }
      );
      calculate();
      setModalOpen(false);
      pushToast('success', 'Экспертные оценки сохранены');
    },
    onError: (err: Error) => pushToast('error', err.message || 'Не удалось сохранить оценки'),
  });

  const summaryRows = useMemo(
    () =>
      userCriteria.map((c) => ({
        criterion: c,
        cells: matrix.scenarios.map((sc) => {
          const effective = matrix.values[sc.id]?.[c.id];
          const defaultVal =
            (defaults as Record<string, number>)[c.id] ??
            RANKING_DEFAULT_EXPERT[c.id as keyof typeof RANKING_DEFAULT_EXPERT];
          return effective ?? defaultVal ?? 0;
        }),
      })),
    [userCriteria, matrix, defaults]
  );

  if (userCriteria.length === 0) {
    return null;
  }

  return (
    <div className="ranking-expert-matrix">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="font-semibold">Экспертные оценки по вариантам</h3>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={saveMut.isPending || settingsSaving}
          onClick={() => setModalOpen(true)}
        >
          Изменить…
        </button>
      </div>
      <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
        Дефолты для пустых ячеек: риск {defaults.risk}, надёжность {defaults.reliability}, время{' '}
        {defaults.time_months} мес.
      </p>
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
            {summaryRows.map(({ criterion, cells }) => (
              <tr key={criterion.id}>
                <td>{criterion.name}</td>
                {cells.map((value, idx) => (
                  <td key={matrix.scenarios[idx]?.id ?? idx} className="col-center tabular">
                    {value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <RankingExpertMatrixModal
        open={modalOpen}
        matrix={matrix}
        defaults={defaults as Record<string, number>}
        saving={saveMut.isPending}
        onClose={() => setModalOpen(false)}
        onApply={(values) => saveMut.mutate(values)}
      />
    </div>
  );
}
