import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AppSelect } from '../AppSelect';
import { api, type RankingCriterion } from '../../lib/api';
import { saatyScaleOptions } from '../../lib/rankingUtils';
import { useRankingContext } from '../../pages/ranking/rankingContext';
import { useAppStore } from '../../store';

type Props = {
  criteria: RankingCriterion[];
};

function buildIdentityPairwise(ids: string[]): Record<string, Record<string, number>> {
  const m: Record<string, Record<string, number>> = {};
  for (const a of ids) {
    m[a] = {};
    for (const b of ids) {
      m[a][b] = a === b ? 1 : 1;
    }
  }
  return m;
}

export function RankingAhpPanel({ criteria }: Props) {
  const { projectId, activePoiId, rankingSettings, updateSettings, invalidateAll } = useRankingContext();
  const pushToast = useAppStore((s) => s.pushToast);
  const ids = criteria.map((c) => c.id);

  const [pairwise, setPairwise] = useState<Record<string, Record<string, number>>>(() => {
    if (rankingSettings?.ahp_pairwise && Object.keys(rankingSettings.ahp_pairwise).length) {
      return rankingSettings.ahp_pairwise;
    }
    return buildIdentityPairwise(ids);
  });

  const ahpMut = useMutation({
    mutationFn: () => api.calculatePoiRankingAhp(projectId!, activePoiId, pairwise),
    onSuccess: async (data) => {
      await updateSettings({
        ahp_pairwise: pairwise,
        weights: data.weights,
      });
      invalidateAll();
      pushToast(
        data.consistency_ratio > 0.1 ? 'info' : 'success',
        data.consistency_ratio > 0.1
          ? `Веса AHP сохранены (CR=${data.consistency_ratio.toFixed(3)} — проверьте согласованность)`
          : `Веса AHP рассчитаны (CR=${data.consistency_ratio.toFixed(3)})`
      );
    },
    onError: (err: Error) => pushToast('error', err.message || 'Ошибка AHP'),
  });

  const pairs = useMemo(() => {
    const out: { a: RankingCriterion; b: RankingCriterion }[] = [];
    for (let i = 0; i < criteria.length; i++) {
      for (let j = i + 1; j < criteria.length; j++) {
        out.push({ a: criteria[i], b: criteria[j] });
      }
    }
    return out;
  }, [criteria]);

  const setPair = (aId: string, bId: string, val: number) => {
    setPairwise((prev) => ({
      ...prev,
      [aId]: { ...prev[aId], [bId]: val, [aId]: 1 },
      [bId]: { ...prev[bId], [aId]: 1 / val, [bId]: 1 },
    }));
  };

  if (criteria.length < 2) {
    return <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Нужно минимум 2 критерия для AHP.</p>;
  }

  return (
    <div className="ranking-ahp">
      <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
        Парные сравнения (шкала Saaty): насколько критерий A важнее B.
      </p>
      <div className="ranking-ahp-pairs">
        {pairs.map(({ a, b }) => {
          const val = pairwise[a.id]?.[b.id] ?? 1;
          return (
            <div key={`${a.id}-${b.id}`} className="ranking-ahp-pair">
              <span className="ranking-ahp-pair__label">{a.name}</span>
              <AppSelect
                variant="sm"
                ariaLabel={`${a.name} vs ${b.name}`}
                value={String(Math.min(9, Math.max(1, Math.round(val))))}
                onChange={(v) => setPair(a.id, b.id, Number(v))}
                options={saatyScaleOptions()}
              />
              <span className="ranking-ahp-pair__label">{b.name}</span>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        className="btn btn-secondary btn-sm mt-3"
        disabled={ahpMut.isPending}
        onClick={() => ahpMut.mutate()}
      >
        {ahpMut.isPending ? 'Расчёт…' : 'Рассчитать веса AHP'}
      </button>
    </div>
  );
}
