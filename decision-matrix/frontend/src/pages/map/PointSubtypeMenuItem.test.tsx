import { describe, expect, it, vi, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PointSubtypeMenuItem } from './PointSubtypeMenuItem';
import { renderPage } from '../../test/pages/renderPage';

describe('PointSubtypeMenuItem', () => {
  afterEach(() => cleanup());

  it('renders label and calls onPick', async () => {
    const onPick = vi.fn();
    renderPage(
      <PointSubtypeMenuItem st="gas_processing" selected={false} onPick={onPick} />,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(onPick).toHaveBeenCalledWith('gas_processing');
  });

  it('shows selected state', () => {
    renderPage(<PointSubtypeMenuItem st="gtes" selected onPick={vi.fn()} />);
    const { container } = renderPage(<PointSubtypeMenuItem st="gtes" selected onPick={vi.fn()} />);
    expect(container.querySelector('button')!.className).toContain('font-medium');
  });
});
