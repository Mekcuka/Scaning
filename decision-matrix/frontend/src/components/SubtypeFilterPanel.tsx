import { SUBTYPE_LABELS } from '../lib/specs';

type Props = {
  subtypeFilter: Record<string, boolean>;
  onSubtypeFilterChange: (subtype: string, visible: boolean) => void;
};

export function SubtypeFilterPanel({ subtypeFilter, onSubtypeFilterChange }: Props) {
  return (
    <div className="p-3 text-sm">
      <div className="font-medium mb-2">Фильтр подтипов</div>
      <div className="flex flex-col gap-1.5 max-h-[min(60vh,420px)] overflow-y-auto">
        {Object.entries(subtypeFilter).map(([subtype, on]) => (
          <label
            key={subtype}
            className="flex items-center gap-2 text-xs cursor-pointer py-0.5"
          >
            <input
              type="checkbox"
              checked={on}
              onChange={(e) => onSubtypeFilterChange(subtype, e.target.checked)}
            />
            <span>{SUBTYPE_LABELS[subtype] || subtype}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
