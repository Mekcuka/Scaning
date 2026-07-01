import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import { AppModal } from '../AppModal';

function ModalWithInput() {
  const [value, setValue] = useState('');
  return (
    <AppModal title="Test modal" onClose={() => setValue('')}>
      <input
        aria-label="Название"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
    </AppModal>
  );
}

describe('AppModal', () => {
  it('keeps focus in body input while parent re-renders on each keystroke', async () => {
    render(<ModalWithInput />);
    const input = screen.getByLabelText('Название');
    await userEvent.click(input);
    await userEvent.type(input, 'Alpha');

    expect(input).toHaveValue('Alpha');
    expect(input).toHaveFocus();
  });
});
