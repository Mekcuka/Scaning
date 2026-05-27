import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { api } from '../lib/api';
import { PoiParamsPanel } from '../components/PoiParamsPanel';
import { useAppStore } from '../store';

const COLORS = ['#94a3b8', '#64748b', '#2563eb'];

export function RankingPage() {
  const projectId = useAppStore((s) => s.currentProjectId);
  const queryClient = useQueryClient();
  const [selectedPoiId, setSelectedPoiId] = useState<string>('');
  const [result, setResult] = useState<Awaited<ReturnType<typeof api.calculatePoiRanking>> | null>(null);
  const [sensitivity, setSensitivity] = useState<Awaited<
    ReturnType<typeof api.calculatePoiRankingSensitivity>
  > | null>(null);

  const { data: pois = [] } = useQuery({
    queryKey: ['pois', projectId],
    queryFn: () => api.getPois(projectId!),
    enabled: !!projectId,
  });
  const activePoiId = selectedPoiId || pois[0]?.id || '';

  const { data: rankingSettings } = useQuery({
    queryKey: ['ranking-settings', projectId, activePoiId],
    queryFn: () => api.getPoiRankingSettings(projectId!, activePoiId),
    enabled: !!projectId && !!activePoiId,
  });

  const algorithm = rankingSettings?.algorithm || 'topsis';

  const calcMut = useMutation({
    mutationFn: () => api.calculatePoiRanking(projectId!, activePoiId),
    onSuccess: setResult,
  });

  const settingsMut = useMutation({
    mutationFn: (nextAlgorithm: string) =>
      api.updatePoiRankingSettings(projectId!, activePoiId, { algorithm: nextAlgorithm }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['ranking-settings', projectId, activePoiId] }),
  });

  const sensitivityMut = useMutation({
    mutationFn: (criterionId: string) => api.calculatePoiRankingSensitivity(projectId!, activePoiId, criterionId),
    onSuccess: setSensitivity,
  });

  const chartData = useMemo(
    () =>
      result
        ? [...result.alternatives].sort((a, b) => a.rank - b.rank).map((r) => ({
            name: r.name,
            score: r.score,
            rank: r.rank,
          }))
        : [],
    [result]
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Ранжирование</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            TOPSIS / WSM — многокритериальный анализ (FR-9)
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <select
            value={activePoiId}
            onChange={(e) => setSelectedPoiId(e.target.value)}
            className="text-sm px-3 py-1.5 rounded-lg border"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
          >
            {pois.map((poi) => (
              <option key={poi.id} value={poi.id}>
                {poi.name}
              </option>
            ))}
          </select>
          <select
            value={algorithm}
            onChange={(e) => settingsMut.mutate(e.target.value)}
            className="text-sm px-3 py-1.5 rounded-lg border"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
          >
            <option value="topsis">TOPSIS</option>
            <option value="wsm">WSM</option>
          </select>
          <button type="button" className="btn btn-primary" disabled={!activePoiId} onClick={() => calcMut.mutate()}>
            Рассчитать
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="card">
          <h2 className="font-semibold mb-4">Критерии и веса</h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Критерий</th>
                  <th>Тип</th>
                  <th>Вес</th>
                </tr>
              </thead>
              <tbody>
                {(rankingSettings?.criteria || []).map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{c.type === 'cost' ? 'Минимизация' : 'Максимизация'}</td>
                    <td>{rankingSettings?.weights?.[c.id] ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2 className="font-semibold mb-4">
            Результат ({result?.algorithm?.toUpperCase() || 'TOPSIS'})
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 80 }}>
              <XAxis type="number" domain={[0, 1]} />
              <YAxis type="category" dataKey="name" width={80} />
              <Tooltip formatter={(v) => (typeof v === 'number' ? v.toFixed(3) : String(v))} />
              <Bar dataKey="score" radius={4}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {result && (
        <div className="card">
          <h2 className="font-semibold mb-3">Ранжирование</h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Место</th>
                  <th>Сценарий</th>
                  <th>Балл</th>
                </tr>
              </thead>
              <tbody>
                {[...result.alternatives]
                  .sort((a, b) => a.rank - b.rank)
                  .map((r) => (
                    <tr key={r.scenario_id || r.name}>
                      <td><span className="badge badge-success">#{r.rank}</span></td>
                      <td>{r.name}</td>
                      <td className="font-mono">{r.score.toFixed(4)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {(rankingSettings?.criteria?.length || 0) > 0 && (
            <div className="mt-4 flex gap-2 items-center">
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Чувствительность:</span>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => sensitivityMut.mutate(rankingSettings!.criteria[0].id)}
              >
                По первому критерию
              </button>
            </div>
          )}
          {sensitivity && (
            <div className="mt-3 text-sm" style={{ color: 'var(--text-muted)' }}>
              Точек анализа: {sensitivity.points.length} (критерий: {sensitivity.criterion_id})
            </div>
          )}
        </div>
      )}

      <PoiParamsPanel
        projectId={projectId}
        readOnly
        showSave={false}
        sections={['basic', 'engineering']}
        title="Параметры POI для ранжирования"
        className="mt-4"
      />
    </div>
  );
}
