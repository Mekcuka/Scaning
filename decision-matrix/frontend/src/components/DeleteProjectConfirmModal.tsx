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
      size="sm"
      closeOnBackdrop={!isPending}
      footer={
        <>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={isPending}
          >
            Отмена
          </button>
          <button
            type="button"
            className="btn btn-primary"
            data-testid="delete-project-confirm"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? 'Удаление…' : 'Удалить'}
          </button>
        </>
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
