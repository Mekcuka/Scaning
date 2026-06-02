import { Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

type YearRow = { year: string; volume: string };

function planToRows(plan: Record<string, number>): YearRow[] {
  return Object.entries(plan)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, volume]) => ({ year, volume: String(volume) }));
}

function rowsToPlan(rows: YearRow[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) {
    const year = row.year.trim();
    if (!/^\d{4}$/.test(year)) continue;
    const n = Number(row.volume.replace(',', '.'));
    if (Number.isFinite(n) && n > 0) out[year] = n;
  }
  return out;
}

function plansEqual(a: Record<string, number>, b: Record<string, number>): boolean {
  const keysA = Object.keys(a).sort();
  const keysB = Object.keys(b).sort();
  if (keysA.length !== keysB.length) return false;
  return keysA.every((k, i) => keysB[i] === k && a[k] === b[k]);
}

export function sandVolumeYearPlanDirty(
  draft: Record<string, number>,
  saved: Record<string, number>,
): boolean {
  return !plansEqual(draft, saved);
}

type Props = {
  value: Record<string, number>;
  onChange: (plan: Record<string, number>) => void;
  readOnly?: boolean;
  emptyMessage?: string;
};

export function SandVolumeYearPlanEditor({
  value,
  onChange,
  readOnly = false,
  emptyMessage = 'Добавьте годы и объёмы плана.',
}: Props) {
  const [rows, setRows] = useState<YearRow[]>(() => planToRows(value));
  const [newYear, setNewYear] = useState('');

  const planSum = useMemo(
    () => Object.values(value).reduce((sum, v) => sum + v, 0),
    [value],
  );

  const syncRows = (nextRows: YearRow[]) => {
    setRows(nextRows);
    onChange(rowsToPlan(nextRows));
  };

  const updateRow = (index: number, patch: Partial<YearRow>) => {
    const next = rows.map((row, i) => (i === index ? { ...row, ...patch } : row));
    syncRows(next);
  };

  const removeRow = (index: number) => {
    syncRows(rows.filter((_, i) => i !== index));
  };

  const addYear = () => {
    const year = newYear.trim();
    if (!/^\d{4}$/.test(year) || rows.some((r) => r.year === year)) return;
    syncRows([...rows, { year, volume: '' }].sort((a, b) => a.year.localeCompare(b.year)));
    setNewYear('');
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-[var(--text-muted)]">План спроса по годам, м³</span>
        {planSum > 0 && (
          <span className="text-xs tabular-nums text-[var(--text-muted)]">Σ {planSum.toLocaleString('ru-RU')}</span>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)]">{emptyMessage}</p>
      ) : (
        <ul className="space-y-1">
          {rows.map((row, index) => (
            <li key={`${row.year}-${index}`} className="flex items-center gap-2">
              <input
                type="number"
                className="input text-sm w-24 shrink-0"
                min={2000}
                max={2100}
                step={1}
                value={row.year}
                readOnly={readOnly}
                disabled={readOnly}
                onChange={(e) => updateRow(index, { year: e.target.value })}
                aria-label="Год"
              />
              <input
                type="number"
                className="input text-sm flex-1 min-w-0"
                min={0}
                step="any"
                placeholder="м³"
                value={row.volume}
                readOnly={readOnly}
                disabled={readOnly}
                onChange={(e) => updateRow(index, { volume: e.target.value })}
                aria-label={`Объём за ${row.year}`}
              />
              {!readOnly && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm shrink-0 p-1"
                  aria-label={`Удалить ${row.year}`}
                  onClick={() => removeRow(index)}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!readOnly && (
        <div className="flex items-center gap-2">
          <input
            type="number"
            className="input text-sm w-24 shrink-0"
            min={2000}
            max={2100}
            step={1}
            placeholder="Год"
            value={newYear}
            onChange={(e) => setNewYear(e.target.value)}
            aria-label="Новый год"
          />
          <button type="button" className="btn btn-secondary btn-sm" onClick={addYear}>
            <Plus size={14} className="inline mr-1" />
            Добавить год
          </button>
        </div>
      )}
      {rows.length > 0 && (
        <p className="text-xs text-[var(--text-muted)]">
          На дату расчёта учитывается накопительная сумма по годам от даты ввода объекта.
        </p>
      )}
    </div>
  );
}

export function readSandVolumeYearPlanFromProperties(
  properties: Record<string, unknown> | null | undefined,
): Record<string, number> {
  const raw = properties?.sand_volume_by_year;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    const year = String(key).trim();
    if (!/^\d{4}$/.test(year)) continue;
    const n = typeof val === 'number' ? val : Number(val);
    if (Number.isFinite(n) && n > 0) out[year] = n;
  }
  return out;
}
