import { useRef, useState } from 'react';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';

import { AnchoredMenu } from '../AnchoredMenu';
import { formatSessionWhen } from '../../lib/assistant/sessionDisplay';
import type { ChatSessionSummary } from '../../lib/assistant/types';

type Props = {
  sessions: ChatSessionSummary[];
  sessionId: string | null;
  disabled?: boolean;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onRequestDelete: (id: string, title: string) => void;
};

export function AssistantSessionMenu({
  sessions,
  sessionId,
  disabled,
  onSelect,
  onNewChat,
  onRequestDelete,
}: Props) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const current = sessions.find((s) => s.id === sessionId);

  return (
    <div className="assistant-session-menu">
      <button
        ref={triggerRef}
        type="button"
        className="assistant-session-menu-trigger"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        title="История диалогов"
      >
        <span className="assistant-session-menu-trigger-label">
          {current ? current.title : 'История чатов'}
          {current && current.message_count > 0 ? ` (${current.message_count})` : ''}
        </span>
        <ChevronDown size={14} className={open ? 'assistant-session-chevron--open' : undefined} />
      </button>

      <AnchoredMenu
        anchorRef={triggerRef}
        open={open}
        onClose={() => setOpen(false)}
        className="app-anchored-menu--flat assistant-session-menu-popover"
        role="listbox"
        ariaLabel="История диалогов"
        zIndex={1350}
      >
        <button
          type="button"
          className="assistant-session-menu-new"
          onClick={() => {
            onNewChat();
            setOpen(false);
          }}
          disabled={disabled}
        >
          <Plus size={14} />
          Новый чат
        </button>

        {sessions.length === 0 ? (
          <p className="assistant-session-menu-empty">Нет сохранённых диалогов</p>
        ) : (
          <ul className="assistant-session-menu-list">
            {sessions.map((s) => {
              const active = s.id === sessionId;
              return (
                <li
                  key={s.id}
                  className={`assistant-session-menu-row${active ? ' assistant-session-menu-row--active' : ''}`}
                >
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    className="assistant-session-menu-item"
                    onClick={() => {
                      onSelect(s.id);
                      setOpen(false);
                    }}
                    disabled={disabled}
                  >
                    <span className="assistant-session-menu-item-title">{s.title}</span>
                    <span className="assistant-session-menu-item-meta">
                      {s.message_count > 0 ? `${s.message_count} сообщ.` : 'пустой'}
                      {' · '}
                      {formatSessionWhen(s.updated_at)}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="assistant-session-menu-delete"
                    title={`Удалить «${s.title}»`}
                    aria-label={`Удалить «${s.title}»`}
                    disabled={disabled}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRequestDelete(s.id, s.title);
                      if (sessionId === s.id) setOpen(false);
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </AnchoredMenu>
    </div>
  );
}
