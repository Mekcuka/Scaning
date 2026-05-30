import { useEffect, useState, type ReactNode } from 'react';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';

const STORAGE_PREFIX = 'flow-schematic-panel-';

function readPanelOpen(storageKey: string): boolean {
  try {
    const v = localStorage.getItem(storageKey);
    if (v === '0') return false;
    if (v === '1') return true;
  } catch {
    /* ignore */
  }
  return true;
}

type FlowSchematicEditPanelProps = {
  panelId: string;
  title: string;
  ariaLabel: string;
  children: ReactNode;
};

export function FlowSchematicEditPanel({
  panelId,
  title,
  ariaLabel,
  children,
}: FlowSchematicEditPanelProps) {
  const storageKey = `${STORAGE_PREFIX}${panelId}`;
  const [open, setOpen] = useState(() => readPanelOpen(storageKey));

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, open ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [open, storageKey]);

  if (!open) {
    return (
      <button
        type="button"
        className="flow-schematic-edit-panel-toggle"
        onClick={() => setOpen(true)}
        title={`Показать: ${title}`}
        aria-label={`Показать: ${title}`}
      >
        <PanelRightOpen size={18} aria-hidden />
      </button>
    );
  }

  return (
    <aside className="flow-schematic-edit-panel" aria-label={ariaLabel}>
      <div className="flow-schematic-edit-panel-head">
        <h3 className="flow-schematic-edit-panel-title">{title}</h3>
        <button
          type="button"
          className="flow-schematic-edit-panel-close btn btn-ghost btn-sm p-1.5"
          onClick={() => setOpen(false)}
          title="Скрыть панель"
          aria-label="Скрыть панель"
        >
          <PanelRightClose size={16} aria-hidden />
        </button>
      </div>
      {children}
    </aside>
  );
}
