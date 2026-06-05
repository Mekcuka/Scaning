export function fmtKm(km: number | null | undefined): string {
  if (km == null) return '—';
  return `${km.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} км`;
}

export function fmtM3(v: number | null | undefined): string {
  if (v == null) return '—';
  return v.toLocaleString('ru-RU', { maximumFractionDigits: 1 });
}

export function formatAllocationByYear(allocation: Record<string, number> | undefined): string | null {
  if (!allocation || Object.keys(allocation).length === 0) return null;
  return Object.entries(allocation)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([y, v]) => `${y}: ${v.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} м³`)
    .join('; ');
}
