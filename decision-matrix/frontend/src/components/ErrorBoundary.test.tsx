import { describe, expect, it, vi, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

function Bomb({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('boom');
  return <span>ok</span>;
}

describe('ErrorBoundary', () => {
  afterEach(() => cleanup());

  it('shows fallback when child throws', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>,
    );
    expect(screen.getByText(/Произошла ошибка/i)).toBeInTheDocument();
    consoleError.mockRestore();
  });

  it('clears error when resetKey changes', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const { rerender } = render(
      <ErrorBoundary resetKey="route-a">
        <Bomb shouldThrow />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('heading', { name: /Произошла ошибка/i })).toBeInTheDocument();

    rerender(
      <ErrorBoundary resetKey="route-b">
        <Bomb shouldThrow={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('ok')).toBeInTheDocument();
    consoleError.mockRestore();
  });
});
