import { Trash2 } from 'lucide-react';
import { Button, Space } from 'antd';

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
        <Space>
          <Button
            type="primary"
            className="object-detail-panel__save"
            disabled={!isDirty}
            loading={saving}
            onClick={handleSave}
            title="Сохранить (Ctrl+S)"
          >
            {saving ? 'Сохранение…' : 'Сохранить'}
          </Button>
          <Button
            danger
            className="object-detail-panel__delete"
            disabled={saving || deleteDisabled}
            icon={<Trash2 size={15} />}
            onClick={onDelete}
            title={deleteDisabled ? 'Удаление недоступно' : 'Удалить объект'}
          >
            Удалить
          </Button>
        </Space>
      )}
    </footer>
  );
}
