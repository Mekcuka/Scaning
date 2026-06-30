import { createPortal } from 'react-dom';
import { Button, Space } from 'antd';

import { AppModal } from '../AppModal';

type Props = {
  title: string;
  isPending?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function DeleteChatConfirmModal({
  title,
  isPending = false,
  onClose,
  onConfirm,
}: Props) {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <AppModal
      title="Удалить диалог?"
      titleId="delete-chat-confirm-title"
      onClose={onClose}
      size="sm"
      closeOnBackdrop={!isPending}
      overlayClassName="app-modal-overlay--stacked"
      footer={
        <Space>
          <Button data-testid="delete-chat-cancel" onClick={onClose} disabled={isPending}>
            Отмена
          </Button>
          <Button
            type="primary"
            danger
            data-testid="delete-chat-confirm"
            onClick={onConfirm}
            loading={isPending}
          >
            {isPending ? 'Удаление…' : 'Удалить'}
          </Button>
        </Space>
      }
    >
      <p className="text-sm mb-2">
        Диалог «<strong>{title}</strong>» и все его сообщения будут удалены без возможности
        восстановления.
      </p>
    </AppModal>,
    document.body,
  );
}
