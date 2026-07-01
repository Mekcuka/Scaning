import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MapDisplayModeToggle } from './MapDisplayModeToggle';

describe('MapDisplayModeToggle', () => {
  afterEach(() => cleanup());

  it('calls onChange when footprints clicked', async () => {
    const onChange = vi.fn();
    render(<MapDisplayModeToggle mode="2d" onChange={onChange} />);
    expect(screen.getByRole('radiogroup', { name: 'Режим карты' })).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Карта площадок'));
    expect(onChange).toHaveBeenCalledWith('footprints');
  });

  it('calls onChange when 3D clicked', async () => {
    const onChange = vi.fn();
    render(<MapDisplayModeToggle mode="2d" onChange={onChange} />);
    await userEvent.click(screen.getByLabelText('Карта 3D'));
    expect(onChange).toHaveBeenCalledWith('3d');
  });
});
