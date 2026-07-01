import { Button, Space } from 'antd';
import { AppModal } from './AppModal';
import type { Project } from '../lib/api';

type Props = {
  project: Project | null;
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function DeleteProjectConfirmModal({
  project,
  isPending,
  onClose,
  onConfirm,
}: Props) {
  if (!project) return null;

  return (
    <AppModal
      title="Удалить проект?"
      titleId="delete-project-confirm-title"
      onClose={onClose}
      size="xs"
      overlayClassName="app-modal-overlay--confirm"
      closeOnBackdrop={!isPending}
      footer={
        <Space>
          <Button onClick={onClose} disabled={isPending}>
            Отмена
          </Button>
          <Button
            type="primary"
            danger
            data-testid="delete-project-confirm"
            onClick={onConfirm}
            loading={isPending}
          >
            {isPending ? 'Удаление…' : 'Удалить'}
          </Button>
        </Space>
      }
    >
      <p className="text-sm mb-2">
        Проект «<strong>{project.name}</strong>» будет удалён без возможности восстановления.
      </p>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        Будут удалены все точки интереса, объекты инфраструктуры и связанные данные.
      </p>
    </AppModal>
  );
}
