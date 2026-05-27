import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { api } from '../lib/api';
import { PoiParamsPanel } from '../components/PoiParamsPanel';
import { useAppStore } from '../store';

const CRITERIA = [
  { name: 'Общая стоимость', weight: 0.35, type: 'cost' },
  { name: 'Общее расстояние', weight: 0.15, type: 'cost' },
  { name: 'Количество превышений', weight: 0.2, type: 'cost' },
  { name: 'Риск реализации', weight: 0.1, type: 'cost' },
  { name: 'Время реализации', weight: 0.1, type: 'cost' },
  { name: 'Надёжность инфраструктуры', weight: 0.1, type: 'benefit' },
];

const SCENARIO_NAMES = ['Базовый', 'Сценарий 1', 'Сценарий 2'];
const DEFAULT_VALUES = [
  [1659, 450, 2, 6, 24, 7],
  [1759, 420, 1, 5, 22, 8],
  [3055, 380, 0, 4, 30, 9],
];

const COLORS = ['#94a3b8', '#64748b', '#2563eb'];

export function RankingPage() {
  const projectId = useAppStore((s) => s.currentProjectId);
  const [algorithm, setAlgorithm] = useState('topsis');
  const [result, setResult] = useState<Awaited<ReturnType<typeof api.calculateRanking>> | null>(null);

  const calcMut = useMutation({
    mutationFn: () =>
      api.calculateRanking({
        algorithm,
        criteria_values: DEFAULT_VALUES,
        criterion_types: CRITERIA.map((c) => c.type),
        weights: CRITERIA.map((c) => c.weight),
      }),
    onSuccess: setResult,
  });

  const chartData = result
    ? result.ranking
        .sort((a, b) => a.rank - b.rank)
        .map((r) => ({
          name: SCENARIO_NAMES[r.index],
          score: r.score,
          rank: r.rank,
        }))
    : [
        { name: 'Сценарий 2', score: 0.72, rank: 1 },
        { name: 'Базовый', score: 0.58, rank: 2 },
        { name: 'Сценарий 1', score: 0.51, rank: 3 },
      ];

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
            value={algorithm}
            onChange={(e) => setAlgorithm(e.target.value)}
            className="text-sm px-3 py-1.5 rounded-lg border"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
          >
            <option value="topsis">TOPSIS</option>
            <option value="wsm">WSM</option>
          </select>
          <button type="button" className="btn btn-primary" onClick={() => calcMut.mutate()}>
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
                {CRITERIA.map((c) => (
                  <tr key={c.name}>
                    <td>{c.name}</td>
                    <td>{c.type === 'cost' ? 'Минимизация' : 'Максимизация'}</td>
                    <td>{c.weight}</td>
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
                {result.ranking
                  .sort((a, b) => a.rank - b.rank)
                  .map((r) => (
                    <tr key={r.index}>
                      <td><span className="badge badge-success">#{r.rank}</span></td>
                      <td>{SCENARIO_NAMES[r.index]}</td>
                      <td className="font-mono">{r.score.toFixed(4)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
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
