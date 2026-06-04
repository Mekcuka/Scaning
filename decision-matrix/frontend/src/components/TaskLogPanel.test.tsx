import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { TaskLogPanel } from './TaskLogPanel';

vi.mock('../lib/api', () => ({
  api: {
    listProjectJobs: vi.fn().mockResolvedValue({ items: [], total: 0, limit: 30 }),
    cancelProjectJob: vi.fn(),
    getActiveProjectJob: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('../hooks/useActiveProjectJob', () => ({
  useActiveProjectJob: () => ({
    activeProjectJob: null,
    projectJobBusy: false,
    isLoading: false,
    refetch: vi.fn(),
  }),
}));

describe('TaskLogPanel', () => {
  it('renders toggle and opens panel', async () => {
    const user = userEvent.setup();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <TaskLogPanel projectId="11111111-1111-1111-1111-111111111111" />
      </QueryClientProvider>,
    );
    const btn = screen.getByTitle('Журнал задач');
    expect(btn).toBeTruthy();
    await user.click(btn);
    expect(screen.getByRole('dialog', { name: 'Журнал задач' })).toBeTruthy();
  });
});
