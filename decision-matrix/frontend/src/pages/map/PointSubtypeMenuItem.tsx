import { iconDataUrl } from '../../lib/mapIcons';
import { pointMenuLabel } from '../../lib/api';

export function PointSubtypeMenuItem({
  st,
  selected,
  onPick,
}: {
  st: string;
  selected: boolean;
  onPick: (st: string) => void;
}) {
  return (
    <button
      type="button"
      className={`w-full text-left px-3 py-1.5 hover:bg-[var(--bg)] flex items-center gap-2 ${
        selected ? 'font-medium' : ''
      }`}
      onClick={() => onPick(st)}
    >
      <img src={iconDataUrl(st)} alt="" className="w-4 h-4 shrink-0" draggable={false} />
      <span className="truncate">{pointMenuLabel(st)}</span>
    </button>
  );
}
