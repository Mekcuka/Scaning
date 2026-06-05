import { ENTRY_YEAR_LANE_COLORS } from '../../../lib/sandLogisticsNodeVisual';

export function SandSchematicLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">
      <span>
        <span className="inline-block w-3 h-3 rounded border-2 border-dashed border-slate-400 align-middle mr-1" />
        будущий ввод
      </span>
      <span className="text-green-700 font-medium">зелёный — спрос покрыт</span>
      <span className="text-amber-700 font-medium">жёлтый — частично</span>
      <span className="text-orange-700 font-medium">оранжевый — нет отгрузки</span>
      <span>
        <span className="inline-block w-4 border-t-2 border-orange-600 align-middle mr-1" />
        активный поток
      </span>
      <span>
        <span
          className="inline-block w-4 border-t-2 border-dashed border-slate-500 align-middle mr-1"
          style={{ borderTopStyle: 'dashed' }}
        />
        плановое плечо
      </span>
    </div>
  );
}

export function EntryYearLegend({ years }: { years: number[] }) {
  if (years.length < 2) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
      <span>Годы ввода:</span>
      {years.map((year, i) => (
        <span key={year} className="inline-flex items-center gap-1">
          <span
            className="inline-block w-1 h-3 rounded-sm"
            style={{ background: ENTRY_YEAR_LANE_COLORS[i % ENTRY_YEAR_LANE_COLORS.length] }}
          />
          {year}
        </span>
      ))}
    </div>
  );
}
