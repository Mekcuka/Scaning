import { useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  type TooltipProps,
  XAxis,
  YAxis,
} from 'recharts';

import type { LineProfilePoint } from '../../lib/api/lineElevationProfileApi';
import { formatChainageM, formatPicket } from '../../lib/lineElevationProfile';

const CHART_HEIGHT = 200;

function fmt(value: number, digits = 1): string {
  return value.toLocaleString('ru-RU', { maximumFractionDigits: digits });
}

function computeElevationDomain(points: LineProfilePoint[]): [number, number] {
  const elevations = points.map((p) => p.elevation_m);
  const minEl = Math.min(...elevations);
  const maxEl = Math.max(...elevations);
  const range = maxEl - minEl;
  const padding = range === 0 ? 5 : Math.max(range * 0.12, 1);
  return [minEl - padding, maxEl + padding];
}

function yTickDigits(domain: [number, number]): number {
  const range = domain[1] - domain[0];
  if (range <= 5) return 2;
  if (range <= 20) return 1;
  return 0;
}

function ProfileTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const chainage = Number(label);
  const elevation = payload[0]?.value;
  if (!Number.isFinite(chainage) || typeof elevation !== 'number') return null;

  return (
    <div className="odp-line-profile__tooltip">
      <div className="odp-line-profile__tooltip-row">
        <span className="odp-line-profile__tooltip-label">Пикет</span>
        <span className="odp-line-profile__tooltip-value">{formatPicket(chainage)}</span>
      </div>
      <div className="odp-line-profile__tooltip-row">
        <span className="odp-line-profile__tooltip-label">Расстояние</span>
        <span className="odp-line-profile__tooltip-value">{formatChainageM(chainage)} м</span>
      </div>
      <div className="odp-line-profile__tooltip-row">
        <span className="odp-line-profile__tooltip-label">Отметка</span>
        <span className="odp-line-profile__tooltip-value">{fmt(elevation, 2)} м</span>
      </div>
    </div>
  );
}

type Props = {
  points: LineProfilePoint[];
};

export function LineElevationProfileChart({ points }: Props) {
  const data = useMemo(
    () =>
      points.map((p) => ({
        chainage_m: p.chainage_m,
        elevation_m: p.elevation_m,
      })),
    [points],
  );

  const yDomain = useMemo(() => computeElevationDomain(points), [points]);
  const yDigits = yTickDigits(yDomain);
  const maxChainage = useMemo(
    () => Math.max(...points.map((p) => p.chainage_m)),
    [points],
  );

  if (data.length < 2) {
    return (
      <p className="object-detail-panel__hint" role="status">
        Недостаточно точек для графика.
      </p>
    );
  }

  return (
    <div className="odp-line-profile__chart" data-testid="line-profile-chart">
      <ResponsiveContainer width="100%" height={CHART_HEIGHT} minWidth={0}>
        <LineChart data={data} margin={{ top: 6, right: 6, left: -6, bottom: 2 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="chainage_m"
            type="number"
            domain={[0, maxChainage]}
            tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
            tickCount={4}
            tickLine={false}
            axisLine={{ stroke: 'var(--border)' }}
            tickFormatter={(v) => fmt(Number(v), 0)}
          />
          <YAxis
            dataKey="elevation_m"
            type="number"
            domain={yDomain}
            tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
            tickCount={4}
            width={34}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => fmt(Number(v), yDigits)}
          />
          <Tooltip content={<ProfileTooltip />} cursor={{ stroke: 'var(--border)' }} />
          <Line
            type="monotone"
            dataKey="elevation_m"
            name="Отметка"
            stroke="var(--primary)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
