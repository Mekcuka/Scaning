import {
  CartesianGrid,
  Label,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { ProfileChartMarker, TrajectoryProfilePoint } from '../../lib/wellTrajectoryProfile';

const CHART_MIN_HEIGHT = 480;

const MARKER_COLORS: Record<ProfileChartMarker['role'], string> = {
  heel: '#2e7d32',
  toe: '#c62828',
};

function fmt(value: number): string {
  return value.toLocaleString('ru-RU', { maximumFractionDigits: 1 });
}

type Props = {
  points: TrajectoryProfilePoint[];
  markers?: ProfileChartMarker[];
};

export function WellTrajectoryProfileChart({ points, markers = [] }: Props) {
  const data = points.map((p) => ({
    md: p.md,
    tvd: p.tvd,
  }));

  if (data.length < 2) return null;

  return (
    <div className="pad-clustering-profile__chart">
      <ResponsiveContainer width="100%" height={CHART_MIN_HEIGHT} minWidth={0}>
        <LineChart data={data} margin={{ top: 20, right: 24, left: 4, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="md"
            type="number"
            tick={{ fontSize: 11 }}
            label={{ value: 'MD, м', position: 'insideBottom', offset: -4, fontSize: 11 }}
          />
          <YAxis
            dataKey="tvd"
            type="number"
            reversed
            tick={{ fontSize: 11 }}
            label={{ value: 'TVD, м', angle: -90, position: 'insideLeft', fontSize: 11 }}
          />
          <Tooltip
            formatter={(value, name) => [
              typeof value === 'number' ? `${fmt(value)} м` : String(value ?? ''),
              String(name).toUpperCase() === 'TVD' ? 'TVD' : 'MD',
            ]}
            labelFormatter={(md) => `MD ${fmt(Number(md))} м`}
          />
          <Line
            type="monotone"
            dataKey="tvd"
            name="TVD"
            stroke="var(--primary)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          {markers.map((marker) => (
            <ReferenceDot
              key={marker.label}
              x={marker.md}
              y={marker.tvd}
              r={5}
              fill={MARKER_COLORS[marker.role]}
              stroke="var(--surface)"
              strokeWidth={2}
              isFront
            >
              <Label
                value={marker.label}
                position={marker.role === 'heel' ? 'top' : 'bottom'}
                offset={10}
                fontSize={11}
                fontWeight={600}
                fill={MARKER_COLORS[marker.role]}
              />
            </ReferenceDot>
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
