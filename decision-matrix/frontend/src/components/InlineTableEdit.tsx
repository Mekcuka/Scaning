import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Pencil, X } from 'lucide-react';

type Props = {
  value: string;
  displayText: string;
  title?: string;
  placeholder?: string;
  multiline?: boolean;
  onSave: (next: string) => void;
  saving?: boolean;
  readOnly?: boolean;
  linkTo?: string;
  onLinkClick?: () => void;
};

export function InlineTableEdit({
  value,
  displayText,
  title,
  placeholder,
  multiline,
  onSave,
  saving,
  readOnly,
  linkTo,
  onLinkClick,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (!editing) return;
    if (multiline) textareaRef.current?.focus();
    else inputRef.current?.focus();
  }, [editing, multiline]);

  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  const save = () => {
    const next = draft.trim();
    if (!next) {
      cancel();
      return;
    }
    if (next !== value.trim()) onSave(next);
    setEditing(false);
  };

  if (editing) {
    const onKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cancel();
      }
      if (e.key === 'Enter' && (!multiline || e.ctrlKey)) {
        e.preventDefault();
        save();
      }
    };

    return (
      <div className="inline-table-edit inline-table-edit--active">
        {multiline ? (
          <textarea
            ref={textareaRef}
            className="inline-table-edit-input"
            value={draft}
            disabled={saving}
            placeholder={placeholder}
            rows={2}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
          />
        ) : (
          <input
            ref={inputRef}
            type="text"
            className="inline-table-edit-input"
            value={draft}
            disabled={saving}
            placeholder={placeholder}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
          />
        )}
        <div className="inline-table-edit-actions">
          <button
            type="button"
            className="inline-table-edit-btn"
            disabled={saving}
            title="Сохранить"
            onClick={save}
          >
            <Check size={14} />
          </button>
          <button
            type="button"
            className="inline-table-edit-btn"
            disabled={saving}
            title="Отмена"
            onClick={cancel}
          >
            <X size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="inline-table-edit">
      {linkTo ? (
        <Link
          to={linkTo}
          className="cell-ellipsis__inner font-medium hover:underline min-w-0"
          style={{ color: 'var(--primary)' }}
          title={title}
          onClick={onLinkClick}
        >
          {displayText}
        </Link>
      ) : (
        <span className="cell-ellipsis__inner" title={title}>
          {displayText}
        </span>
      )}
      {!readOnly && (
      <button
        type="button"
        className="inline-table-edit-trigger"
        title="Изменить"
        disabled={saving}
        onClick={() => setEditing(true)}
      >
        <Pencil size={13} />
      </button>
      )}
    </div>
  );
}
