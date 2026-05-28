import type { Project } from './api';

const SPARKLINE_HEIGHTS = [40, 55, 30, 70, 45, 85, 60];

/** Max visible characters in projects table before «…» */
export const PROJECT_TABLE_NAME_MAX = 40;
export const PROJECT_TABLE_DESC_MAX = 100;

export type ProjectStatusValue = 'draft' | 'in_progress' | 'calculated';

export const PROJECT_STATUS_OPTIONS: {
  value: ProjectStatusValue;
  label: string;
  className: string;
}[] = [
  { value: 'draft', label: 'Черновик', className: 'status-draft' },
  { value: 'in_progress', label: 'В работе', className: 'status-in-progress' },
  { value: 'calculated', label: 'Расчитан', className: 'status-calculated' },
];

export function normalizeProjectStatus(status: string): ProjectStatusValue {
  if (status === 'active') return 'in_progress';
  if (status === 'analysis') return 'calculated';
  if (status === 'in_progress' || status === 'calculated' || status === 'draft') {
    return status;
  }
  return 'draft';
}

export function ellipsisText(
  text: string | null | undefined,
  maxLength: number,
  fallback = '—'
): string {
  const value = (text ?? '').trim();
  if (!value) return fallback;
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}…`;
}

export function projectStatus(status: string) {
  const key = normalizeProjectStatus(status);
  return (
    PROJECT_STATUS_OPTIONS.find((o) => o.value === key) ?? PROJECT_STATUS_OPTIONS[0]
  );
}

export function formatProjectDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function sparklineBars(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash + seed.charCodeAt(i) * (i + 1)) % 997;
  return SPARKLINE_HEIGHTS.map((h, j) => {
    const height = ((hash + j * 17) % 50) + h * 0.5;
    return (
      <span
        key={j}
        style={{ height: `${Math.min(100, height)}%` }}
      />
    );
  });
}

export function filterProjectsByQuery(projects: Project[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return projects;
  return projects.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      (p.description?.toLowerCase().includes(q) ?? false),
  );
}
