import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DeleteChatConfirmModal } from './DeleteChatConfirmModal';

describe('DeleteChatConfirmModal', () => {
  afterEach(() => cleanup());

  it('shows title and calls onConfirm', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    render(
      <DeleteChatConfirmModal
        title="Список POI в текущем проекте"
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Список POI в текущем проекте/)).toBeInTheDocument();

    await user.click(screen.getByTestId('delete-chat-confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onClose from cancel button', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <DeleteChatConfirmModal
        title="Тест"
        onClose={onClose}
        onConfirm={vi.fn()}
      />,
    );

    await user.click(screen.getByTestId('delete-chat-cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
