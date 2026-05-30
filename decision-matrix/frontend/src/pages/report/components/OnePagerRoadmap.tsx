import { useMemo } from 'react';
import type { OnePagerRoadmapStage } from '../../../lib/api';
import { ganttAxisTicks, ganttChartSpanMonths, roadmapToGantt } from '../reportUtils';

type Props = {
  roadmap: OnePagerRoadmapStage[];
  readOnly?: boolean;
  onChange?: (roadmap: OnePagerRoadmapStage[]) => void;
};

const BAR_COLORS = [
  '#0b5cad',
  '#1276c7',
  '#1a8fe0',
  '#23a8f5',
  '#2fc0ff',
  '#00a896',
];

function formatRange(start: number, end: number | null, openEnded: boolean): string {
  if (openEnded) return `${start}+ мес.`;
  if (end == null) return `${start} мес.`;
  return `${start}–${end} мес.`;
}

export function OnePagerRoadmap({ roadmap, readOnly, onChange }: Props) {
  const segments = useMemo(() => roadmapToGantt(roadmap), [roadmap]);
  const spanMonths = useMemo(() => ganttChartSpanMonths(segments), [segments]);
  const ticks = useMemo(() => ganttAxisTicks(spanMonths), [spanMonths]);

  const pct = (month: number) => `${Math.min(100, Math.max(0, (month / spanMonths) * 100))}%`;

  return (
    <div className="one-pager-roadmap">
      <h4 className="one-pager-subheading">Дорожная карта</h4>
      <div className="roadmap-gantt" role="img" aria-label="Дорожная карта в формате Ганта">
        <div className="roadmap-gantt__grid">
          {segments.map((seg) => {
            const left = pct(seg.startMonth);
            const width =
              seg.isOpenEnded || seg.endMonth == null
                ? `calc(100% - ${left})`
                : pct(seg.endMonth - seg.startMonth);
            const color = BAR_COLORS[seg.index % BAR_COLORS.length];

            return (
              <div key={`${seg.stage}-${seg.index}`} className="roadmap-gantt__row">
                <div className="roadmap-gantt__label" title={seg.stage}>
                  {seg.stage}
                </div>
                <div className="roadmap-gantt__track">
                  <div
                    className={`roadmap-gantt__bar${seg.isOpenEnded ? ' roadmap-gantt__bar--open' : ''}`}
                    style={{ left, width, background: color }}
                    title={formatRange(seg.startMonth, seg.endMonth, seg.isOpenEnded)}
                  >
                    {!seg.isOpenEnded && seg.durationMonths != null && seg.durationMonths > 0 && (
                      <span className="roadmap-gantt__bar-label">{seg.durationMonths} мес.</span>
                    )}
                    {seg.isOpenEnded && <span className="roadmap-gantt__bar-label">∞</span>}
                  </div>
                </div>
                <div className="roadmap-gantt__meta">
                  {readOnly || !onChange || seg.isOpenEnded ? (
                    <span>{formatRange(seg.startMonth, seg.endMonth, seg.isOpenEnded)}</span>
                  ) : (
                    <input
                      type="number"
                      className="roadmap-gantt__input"
                      min={seg.startMonth + 1}
                      value={seg.endMonth ?? ''}
                      aria-label={`Срок окончания этапа «${seg.stage}», мес.`}
                      onChange={(e) => {
                        const val = e.target.value === '' ? null : Number(e.target.value);
                        const next = roadmap.map((s, i) =>
                          i === seg.index ? { ...s, duration_months: val } : s
                        );
                        onChange(next);
                      }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="roadmap-gantt__axis">
          <div className="roadmap-gantt__axis-spacer" aria-hidden />
          <div className="roadmap-gantt__axis-track">
            {ticks.map((t) => (
              <span key={t} className="roadmap-gantt__tick" style={{ left: pct(t) }}>
                {t}
              </span>
            ))}
          </div>
          <div className="roadmap-gantt__axis-unit">мес.</div>
        </div>
      </div>
    </div>
  );
}
