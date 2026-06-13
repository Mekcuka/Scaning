import type { ReactNode } from 'react';
import { Calculator, Settings2 } from 'lucide-react';

export type PadClusteringSidebarTab = 'pad' | 'calc';

type Props = {
  active: PadClusteringSidebarTab;
  onChange: (tab: PadClusteringSidebarTab) => void;
  calcDirty?: boolean;
  children: ReactNode;
};

export function PadClusteringSidebarTabs({ active, onChange, calcDirty, children }: Props) {
  return (
    <div className="pad-clustering-sidebar-tabs">
      <div className="pad-clustering-sidebar-tabs__bar" role="tablist" aria-label="Панели настроек">
        <button
          type="button"
          role="tab"
          aria-selected={active === 'pad'}
          className={`pad-clustering-sidebar-tabs__tab${active === 'pad' ? ' pad-clustering-sidebar-tabs__tab--active' : ''}`}
          onClick={() => onChange('pad')}
        >
          <Settings2 size={15} aria-hidden />
          Куст
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={active === 'calc'}
          className={`pad-clustering-sidebar-tabs__tab${active === 'calc' ? ' pad-clustering-sidebar-tabs__tab--active' : ''}`}
          onClick={() => onChange('calc')}
        >
          <Calculator size={15} aria-hidden />
          Расчёт
          {calcDirty ? <span className="pad-clustering-sidebar-tabs__dot" title="Есть изменения" /> : null}
        </button>
      </div>
      <div className="pad-clustering-sidebar-tabs__panel" role="tabpanel">
        {children}
      </div>
    </div>
  );
}
