import { useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AppSelect } from '../../components/AppSelect';
import { RankingEmptyState } from '../../components/ranking/RankingEmptyState';
import { RankingTornadoChart, RankingTornadoOverview } from '../../components/ranking/RankingTornadoChart';
import { api, type RankingSensitivityResult } from '../../lib/api';
import { useRankingContext } from './rankingContext';

export function RankingSensitivityPage() {
  const { projectId, pois, activePoiId, rankingSettings } = useRankingContext();
  const criteria = rankingSettings?.criteria ?? [];
  const weights = rankingSettings?.weights ?? {};

  const [criterionId, setCriterionId] = useState(criteria[0]?.id ?? '');
  const [weightPct, setWeightPct] = useState(Math.round((weights[criteria[0]?.id ?? ''] ?? 0.1) * 100));
  const [sensitivity, setSensitivity] = useState<RankingSensitivityResult | null>(null);
  const [overview, setOverview] = useState<
    { criterionId: string; criterionName: string; data: RankingSensitivityResult }[]
  >([]);

  useEffect(() => {
    if (criteria.length && !criteria.some((c) => c.id === criterionId)) {
      setCriterionId(criteria[0].id);
    }
  }, [criteria, criterionId]);

  useEffect(() => {
    setWeightPct(Math.round((weights[criterionId] ?? 0.1) * 100));
  }, [criterionId, weights]);

  const sensMut = useMutation({
    mutationFn: (cid: string) => api.calculatePoiRankingSensitivity(projectId!, activePoiId, cid),
    onSuccess: setSensitivity,
  });

  const overviewMut = useMutation({
    mutationFn: async () => {
      const items = await Promise.all(
        criteria.map(async (c) => ({
          criterionId: c.id,
          criterionName: c.name,
          data: await api.calculatePoiRankingSensitivity(projectId!, activePoiId, c.id),
        }))
      );
      return items;
    },
    onSuccess: setOverview,
  });

  useEffect(() => {
    if (projectId && activePoiId && criterionId) {
      sensMut.mutate(criterionId);
    }
  }, [projectId, activePoiId, criterionId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (projectId && activePoiId && criteria.length > 0) {
      overviewMut.mutate();
    }
  }, [projectId, activePoiId, criteria.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const criterionName = useMemo(
    () => criteria.find((c) => c.id === criterionId)?.name ?? criterionId,
    [criteria, criterionId]
  );

  const liveDelta = useMemo(() => {
    const base = weights[criterionId] ?? 0.1;
    return weightPct / 100 - base;
  }, [weightPct, weights, criterionId]);

  if (!projectId) return <RankingEmptyState kind="no-project" />;
  if (pois.length === 0) return <RankingEmptyState kind="no-poi" />;

  return (
    <div className="ranking-sensitivity">
      <h2 className="ranking-tab-title">Анализ чувствительности</h2>
      <div className="card mb-4">
        <h2 className="font-semibold mb-3">Анализ чувствительности</h2>
        <div className="flex flex-wrap gap-3 items-end mb-4">
          <label className="form-group mb-0">
            <span className="text-sm">Критерий</span>
            <AppSelect
              variant="sm"
              ariaLabel="Критерий для анализа"
              value={criterionId}
              onChange={setCriterionId}
              options={criteria.map((c) => ({ value: c.id, label: c.name }))}
            />
          </label>
          <label className="form-group mb-0 flex-1 min-w-[200px]">
            <span className="text-sm">
              Вес «{criterionName}»: {weightPct}% (Δ {(liveDelta * 100).toFixed(0)}% от текущего)
            </span>
            <input
              type="range"
              min={1}
              max={95}
              value={weightPct}
              className="ranking-weights-slider w-full"
              onChange={(e) => setWeightPct(Number(e.target.value))}
            />
          </label>
        </div>
        {sensMut.isPending && (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Расчёт…
          </p>
        )}
        {sensitivity && (
          <RankingTornadoChart data={sensitivity} criterionName={criterionName} />
        )}
      </div>

      {overview.length > 0 && (
        <div className="card">
          <h2 className="font-semibold mb-3">Tornado — устойчивость по всем критериям</h2>
          <RankingTornadoOverview items={overview} />
        </div>
      )}
    </div>
  );
}
