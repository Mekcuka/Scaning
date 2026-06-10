import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { POI_SECTION_LABELS, type PoiSectionId } from '../../lib/poiParams';

export function PoiAccordionSection({
  id,
  open,
  onToggle,
  children,
}: {
  id: PoiSectionId;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="border rounded-lg mb-2" style={{ borderColor: 'var(--border)' }}>
      <button
        type="button"
        className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-left"
        onClick={onToggle}
      >
        {POI_SECTION_LABELS[id]}
        <ChevronDown size={16} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-3 pb-3 pt-0">{children}</div>}
    </div>
  );
}
