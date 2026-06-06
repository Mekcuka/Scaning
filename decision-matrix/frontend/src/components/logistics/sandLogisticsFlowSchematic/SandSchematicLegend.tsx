import { ENTRY_YEAR_LANE_COLORS } from '../../../lib/sandLogisticsNodeVisual';

const LEGEND_ITEMS = [
  {
    swatch: (
      <span className="sand-schematic-legend__swatch sand-schematic-legend__swatch--future" aria-hidden />
    ),
    label: 'Будущий ввод',
  },
  {
    swatch: <span className="sand-schematic-legend__swatch sand-schematic-legend__swatch--ok" aria-hidden />,
    label: 'Спрос покрыт',
  },
  {
    swatch: (
      <span className="sand-schematic-legend__swatch sand-schematic-legend__swatch--partial" aria-hidden />
    ),
    label: 'Частично',
  },
  {
    swatch: (
      <span className="sand-schematic-legend__swatch sand-schematic-legend__swatch--none" aria-hidden />
    ),
    label: 'Нет отгрузки',
  },
  {
    swatch: (
      <span className="sand-schematic-legend__swatch sand-schematic-legend__swatch--flow" aria-hidden />
    ),
    label: 'Поток',
  },
  {
    swatch: (
      <span className="sand-schematic-legend__swatch sand-schematic-legend__swatch--planned" aria-hidden />
    ),
    label: 'План',
  },
] as const;

export function SandSchematicLegend() {
  return (
    <div className="sand-schematic-legend" aria-label="Условные обозначения схемы">
      {LEGEND_ITEMS.map((item) => (
        <span key={item.label} className="sand-schematic-legend__item">
          {item.swatch}
          {item.label}
        </span>
      ))}
    </div>
  );
}

export function EntryYearLegend({ years }: { years: number[] }) {
  if (years.length < 2) return null;
  return (
    <div className="sand-schematic-legend sand-schematic-legend--years">
      <span className="sand-schematic-legend__title">Годы ввода</span>
      {years.map((year, i) => (
        <span key={year} className="sand-schematic-legend__item">
          <span
            className="sand-schematic-legend__year-mark"
            style={{ background: ENTRY_YEAR_LANE_COLORS[i % ENTRY_YEAR_LANE_COLORS.length] }}
            aria-hidden
          />
          {year}
        </span>
      ))}
    </div>
  );
}
