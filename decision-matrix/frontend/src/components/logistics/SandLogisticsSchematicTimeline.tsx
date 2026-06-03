import { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { SandLogisticsSubnet } from '../../lib/api';
import { formatEntryDateRu } from '../../lib/infraEntryDate';
import {
  collectSubnetEntryMarkers,
  datePositionPct,
  groupMarkersByYear,
  layoutYearMarkers,
  viewAsOfForYear,
  yearIndexInHorizon,
  yearsInHorizon,
} from '../../lib/sandLogisticsSchematicTimeline';

type Props = {
  subnet: SandLogisticsSubnet;
  horizonFrom: string;
  horizonTo: string;
  viewAsOf: string;
  onViewAsOfChange: (next: string) => void;
};

function entryCountLabel(count: number): string {
  if (count === 1) return '1 ввод';
  if (count >= 2 && count <= 4) return `${count} ввода`;
  return `${count} вводов`;
}

export function SandLogisticsSchematicTimeline({
  subnet,
  horizonFrom,
  horizonTo,
  viewAsOf,
  onViewAsOfChange,
}: Props) {
  const years = useMemo(() => yearsInHorizon(horizonFrom, horizonTo), [horizonFrom, horizonTo]);
  const markers = useMemo(() => collectSubnetEntryMarkers(subnet), [subnet]);
  const sliderIndex = yearIndexInHorizon(viewAsOf, years);
  const showSlider = years.length > 1;
  const viewYear = Number.parseInt(viewAsOf.slice(0, 4), 10);
  const viewPct = datePositionPct(viewAsOf, horizonFrom, horizonTo);

  const markersByYear = useMemo(() => groupMarkersByYear(markers), [markers]);

  const goToIndex = (idx: number) => {
    const clamped = Math.max(0, Math.min(years.length - 1, idx));
    const year = years[clamped];
    if (year != null) onViewAsOfChange(viewAsOfForYear(year));
  };

  if (markers.length === 0 && !showSlider) return null;

  const track = (
    <div className="sand-logistics-timeline__track-wrap" aria-hidden={markers.length === 0 && !showSlider}>
      <div className="sand-logistics-timeline__track-bg" />
      <div className="sand-logistics-timeline__track-past" style={{ width: `${viewPct}%` }} />
      {years.map((year) => {
        const active = year === viewYear;
        return (
          <span
            key={year}
            className={`sand-logistics-timeline__tick${active ? ' sand-logistics-timeline__tick--active' : ''}`}
            style={{ left: `${datePositionPct(viewAsOfForYear(year), horizonFrom, horizonTo)}%` }}
          >
            {year}
          </span>
        );
      })}
      {[...markersByYear.entries()].map(([year, yearMarkers]) => {
        const left = datePositionPct(viewAsOfForYear(year), horizonFrom, horizonTo);
        const { visible, overflowCount } = layoutYearMarkers(yearMarkers);
        const sliceDate = viewAsOfForYear(year);
        const isPastSlice = sliceDate <= viewAsOf;
        const overflowTitle =
          overflowCount > 0
            ? `${year}: ещё ${overflowCount} ${overflowCount === 1 ? 'объект' : overflowCount < 5 ? 'объекта' : 'объектов'}`
            : undefined;
        return (
          <div
            key={year}
            className="sand-logistics-timeline__year-cluster"
            style={{ left: `${left}%` }}
            title={overflowTitle}
          >
            {visible.map((marker) => {
              const markerPast = marker.entryDate <= viewAsOf;
              return (
                <button
                  key={marker.objectId}
                  type="button"
                  className={`sand-logistics-timeline__marker sand-logistics-timeline__marker--${marker.kind}${
                    markerPast ? ' sand-logistics-timeline__marker--active' : ''
                  }`}
                  title={`${marker.name} · ввод ${formatEntryDateRu(marker.entryDate)}`}
                  aria-label={`${marker.name}, ввод ${formatEntryDateRu(marker.entryDate)}`}
                  onClick={() => onViewAsOfChange(viewAsOfForYear(marker.year))}
                />
              );
            })}
            {overflowCount > 0 && (
              <button
                type="button"
                className={`sand-logistics-timeline__overflow${isPastSlice ? ' sand-logistics-timeline__overflow--active' : ''}`}
                title={overflowTitle}
                aria-label={`${year}, всего ${yearMarkers.length} вводов`}
                onClick={() => onViewAsOfChange(sliceDate)}
              >
                +{overflowCount}
              </button>
            )}
          </div>
        );
      })}
      <div className="sand-logistics-timeline__cursor" style={{ left: `${viewPct}%` }} />
      {showSlider && (
        <input
          type="range"
          className="sand-logistics-timeline__slider"
          min={0}
          max={years.length - 1}
          step={1}
          value={sliderIndex}
          onChange={(e) => goToIndex(Number(e.target.value))}
          aria-label="Год среза для схемы"
          aria-valuetext={`Срез на 31 декабря ${years[sliderIndex]}`}
        />
      )}
    </div>
  );

  return (
    <div className="sand-logistics-timeline" role="group" aria-label="Временная шкала схемы">
      <div className="sand-logistics-timeline__head">
        <div className="sand-logistics-timeline__head-text">
          <span className="sand-logistics-timeline__title">Срез схемы</span>
          <span className="sand-logistics-timeline__hint">
            Объекты и потоки — на конец выбранного года
          </span>
        </div>
        <span className="sand-logistics-timeline__badge">{formatEntryDateRu(viewAsOf)}</span>
      </div>

      {showSlider ? (
        <div className="sand-logistics-timeline__controls">
          <button
            type="button"
            className="sand-logistics-timeline__step"
            disabled={sliderIndex <= 0}
            onClick={() => goToIndex(sliderIndex - 1)}
            aria-label="Предыдущий год"
          >
            <ChevronLeft size={18} aria-hidden />
          </button>
          {track}
          <button
            type="button"
            className="sand-logistics-timeline__step"
            disabled={sliderIndex >= years.length - 1}
            onClick={() => goToIndex(sliderIndex + 1)}
            aria-label="Следующий год"
          >
            <ChevronRight size={18} aria-hidden />
          </button>
        </div>
      ) : (
        track
      )}

      {showSlider && (
        <div className="sand-logistics-timeline__years" role="tablist" aria-label="Быстрый выбор года">
          {years.map((year) => {
            const count = markersByYear.get(year)?.length ?? 0;
            const active = year === viewYear;
            return (
              <button
                key={year}
                type="button"
                role="tab"
                aria-selected={active}
                className={`sand-logistics-timeline__year${active ? ' sand-logistics-timeline__year--active' : ''}${
                  count > 0 ? ' sand-logistics-timeline__year--has-entries' : ''
                }`}
                title={count > 0 ? `${year}: ${entryCountLabel(count)}` : String(year)}
                onClick={() => onViewAsOfChange(viewAsOfForYear(year))}
              >
                <span>{year}</span>
                {count > 0 && (
                  <span className="sand-logistics-timeline__year-count" aria-hidden>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {markers.length > 0 && (
        <div className="sand-logistics-timeline__legend">
          <span>
            <span className="sand-logistics-timeline__legend-mark sand-logistics-timeline__legend-mark--quarry" />
            карьер
          </span>
          <span>
            <span className="sand-logistics-timeline__legend-mark sand-logistics-timeline__legend-mark--consumer" />
            потребитель
          </span>
          <span className="sand-logistics-timeline__legend-note">точки — даты ввода объектов</span>
        </div>
      )}
    </div>
  );
}
