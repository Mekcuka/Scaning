import { Trash2 } from 'lucide-react';

interface ObjectDetailPanelFooterProps {
  readOnly: boolean;
  saving?: boolean;
  isDirty: boolean;
  deleteDisabled: boolean;
  handleSave: () => void;
  onDelete: () => void;
}

export function ObjectDetailPanelFooter({
  readOnly,
  saving,
  isDirty,
  deleteDisabled,
  handleSave,
  onDelete,
}: ObjectDetailPanelFooterProps) {
  return (
    <footer className="object-detail-panel__footer">
      {!readOnly && (
        <>
          <button
            type="button"
            className="btn btn-primary object-detail-panel__save"
            disabled={saving || !isDirty}
            onClick={handleSave}
            title="Сохранить (Ctrl+S)"
          >
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
          <button
            type="button"
            className="btn btn-secondary object-detail-panel__delete"
            disabled={saving || deleteDisabled}
            onClick={onDelete}
            title={
              deleteDisabled
                ? 'Удаление недоступно'
                : 'Удалить объект'
            }
          >
            <Trash2 size={15} />
            Удалить
          </button>
        </>
      )}
    </footer>
  );
}
