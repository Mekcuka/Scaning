import { useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  readPadClusteringSectionOpen,
  writePadClusteringSectionOpen,
} from '../../lib/padClusteringSectionState';

type PadClusteringCollapsibleSectionProps = {
  id: string;
  title: string;
  icon?: ReactNode;
  badge?: ReactNode;
  hint?: string;
  defaultOpen?: boolean;
  children: ReactNode;
};

export function PadClusteringCollapsibleSection({
  id,
  title,
  icon,
  badge,
  hint,
  defaultOpen = true,
  children,
}: PadClusteringCollapsibleSectionProps) {
  const [open, setOpen] = useState(() => readPadClusteringSectionOpen(id, defaultOpen));
  const panelId = useId();

  const toggleOpen = () => {
    setOpen((prev) => {
      const next = !prev;
      writePadClusteringSectionOpen(id, next);
      return next;
    });
  };

  return (
    <section
      id={id}
      className={`pad-clustering-section pad-clustering-section--collapsible${open ? ' pad-clustering-section--open' : ''}`}
    >
      <button
        type="button"
        className="pad-clustering-section__toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggleOpen}
      >
        <span className="pad-clustering-section__toggle-main">
          {icon ? <span className="pad-clustering-section__icon">{icon}</span> : null}
          <span className="pad-clustering-section__title">{title}</span>
          {badge}
        </span>
        <ChevronDown
          size={18}
          className={`pad-clustering-section__chevron${open ? ' pad-clustering-section__chevron--open' : ''}`}
          aria-hidden
        />
      </button>
      {hint && !open && <p className="pad-clustering-section__hint pad-clustering-section__hint--collapsed">{hint}</p>}
      <div
        id={panelId}
        className={`pad-clustering-section__body${open ? '' : ' pad-clustering-section__body--hidden'}`}
        hidden={!open}
      >
        {hint && open && <p className="pad-clustering-section__hint">{hint}</p>}
        {children}
      </div>
    </section>
  );
}
