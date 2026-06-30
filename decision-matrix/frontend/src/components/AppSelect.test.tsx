import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppSelect } from './AppSelect';

describe('AppSelect', () => {
  it('opens listbox and selects option', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <AppSelect
        ariaLabel="Test select"
        value="a"
        onChange={onChange}
        options={[
          { value: 'a', label: 'Alpha' },
          { value: 'b', label: 'Beta' },
        ]}
      />,
    );
    await user.click(screen.getByRole('combobox', { name: 'Test select' }));
    await user.click(screen.getByText('Beta'));
    expect(onChange).toHaveBeenCalledWith('b');
  });
});
