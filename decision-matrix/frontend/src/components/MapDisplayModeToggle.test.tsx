import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MapDisplayModeToggle } from './MapDisplayModeToggle';

describe('MapDisplayModeToggle', () => {
  afterEach(() => cleanup());

  it('renders icon buttons with active 2D state', () => {
    render(<MapDisplayModeToggle mode="2d" onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Карта 2D' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Карта площадок' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Карта 3D' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onChange when footprints clicked', async () => {
    const onChange = vi.fn();
    render(<MapDisplayModeToggle mode="2d" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Карта площадок' }));
    expect(onChange).toHaveBeenCalledWith('footprints');
  });

  it('calls onChange when 3D clicked', async () => {
    const onChange = vi.fn();
    render(<MapDisplayModeToggle mode="2d" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Карта 3D' }));
    expect(onChange).toHaveBeenCalledWith('3d');
  });
});
