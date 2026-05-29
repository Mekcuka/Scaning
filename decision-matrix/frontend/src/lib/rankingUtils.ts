/** Client-side weight rebalance (mirrors backend rebalance_weights). */
export function rebalanceRankingWeights(
  base: Record<string, number>,
  targetId: string,
  delta: number
): Record<string, number> {
  const weights = Object.fromEntries(Object.entries(base).map(([k, v]) => [k, Number(v)]));
  if (!(targetId in weights)) return weights;
  const oldTarget = weights[targetId];
  const newTarget = Math.max(0.01, Math.min(0.95, oldTarget + delta));
  const remainderOld = Math.max(1e-6, 1 - oldTarget);
  const remainderNew = 1 - newTarget;
  for (const key of Object.keys(weights)) {
    if (key === targetId) {
      weights[key] = newTarget;
    } else {
      weights[key] = Math.max(0, weights[key] * (remainderNew / remainderOld));
    }
  }
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  return Object.fromEntries(Object.entries(weights).map(([k, v]) => [k, v / total]));
}

export function weightsSum(weights: Record<string, number>): number {
  return Object.values(weights).reduce((a, b) => a + Number(b), 0);
}

export const RANK_MEDAL_CLASS: Record<number, string> = {
  1: 'rank-medal--gold',
  2: 'rank-medal--silver',
  3: 'rank-medal--bronze',
};

export const RANK_COLORS = [
  'var(--primary)',
  '#64748b',
  '#94a3b8',
  '#cbd5e1',
  '#e2e8f0',
];

export function rankColor(rank: number): string {
  if (rank <= 3) {
    return rank === 1 ? '#2563eb' : rank === 2 ? '#64748b' : '#94a3b8';
  }
  return '#cbd5e1';
}

export function scenarioTypeLabel(type: string | null | undefined): string {
  if (type === 'poi') return 'Точка интереса';
  if (type === 'base') return 'Базовый';
  if (type === 'scenario') return 'Сценарий';
  return type ?? '—';
}

export function rankingAlternativeId(alt: {
  poi_id?: string | null;
  scenario_id?: string | null;
  name: string;
}): string {
  return String(alt.poi_id ?? alt.scenario_id ?? alt.name);
}

export function isPoiRanking(result: { ranking_unit?: string } | null | undefined): boolean {
  return result?.ranking_unit === 'poi';
}

export function formatWeight(w: number): string {
  return w.toFixed(3);
}

export function saatyScaleOptions() {
  return [
    { value: '1', label: '1 — равно' },
    { value: '2', label: '2' },
    { value: '3', label: '3 — умеренно' },
    { value: '4', label: '4' },
    { value: '5', label: '5 — сильно' },
    { value: '6', label: '6' },
    { value: '7', label: '7 — очень' },
    { value: '8', label: '8' },
    { value: '9', label: '9 — крайне' },
  ];
}
