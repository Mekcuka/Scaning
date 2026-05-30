import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { SandLogisticsConsumerRow, SandLogisticsQuarryRow } from '../../lib/api';

const CHART_HEIGHT = 280;

function chartLabel(name: string | null | undefined, maxLen = 18): string {
  const label = (name ?? '').trim() || '—';
  return label.length > maxLen ? `${label.slice(0, maxLen - 1)}…` : label;
}

export function SandLogisticsQuarryAllocationChart({ quarries }: { quarries: SandLogisticsQuarryRow[] }) {
  const data = quarries.map((q) => ({
    name: chartLabel(q.name),
    greedy: q.greedy_allocated_m3,
    proportional: q.proportional_allocated_m3,
  }));

  if (data.length === 0) return null;

  return (
    <div className="min-w-0 w-full" style={{ minHeight: CHART_HEIGHT }}>
      <h3 className="text-sm font-medium mb-2">Отгрузка по карьерам, м³</h3>
      <ResponsiveContainer width="100%" height={CHART_HEIGHT} minWidth={0}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-25} textAnchor="end" height={60} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={(value) => [
              typeof value === 'number'
                ? value.toLocaleString('ru-RU', { maximumFractionDigits: 1 })
                : String(value ?? ''),
              '',
            ]}
          />
          <Legend />
          <Bar dataKey="greedy" name="Жадный" fill="var(--accent)" radius={[2, 2, 0, 0]} />
          <Bar dataKey="proportional" name="Пропорциональный" fill="#94a3b8" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SandLogisticsConsumerDistanceChart({
  consumers,
}: {
  consumers: SandLogisticsConsumerRow[];
}) {
  const data = consumers
    .filter((c) => c.distance_km != null && c.demand_m3 > 0)
    .map((c) => ({
      name: chartLabel(c.name),
      km: c.distance_km as number,
    }));

  if (data.length === 0) return null;

  return (
    <div className="min-w-0 w-full" style={{ minHeight: CHART_HEIGHT }}>
      <h3 className="text-sm font-medium mb-2">Расстояние до ближайшего карьера, км</h3>
      <ResponsiveContainer width="100%" height={CHART_HEIGHT} minWidth={0}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-25} textAnchor="end" height={60} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={(value) => [
              typeof value === 'number'
                ? `${value.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} км`
                : String(value ?? ''),
              'Сеть',
            ]}
          />
          <Bar dataKey="km" name="км" fill="var(--accent)" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
