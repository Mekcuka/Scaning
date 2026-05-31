import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { ImportPage } from './ImportPage';
import { renderWithProviders } from '../test/renderWithProviders';

vi.mock('../lib/api', () => ({
  api: {
    listImportConnections: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../hooks/usePermissions', () => ({
  usePermissions: () => ({ can: () => true, hasRole: () => true }),
}));

vi.mock('../hooks/useActiveProject', () => ({
  useActiveProject: () => ({ projectId: 'p1', project: { id: 'p1', name: 'P' } }),
}));

describe('ImportPage smoke', () => {
  it('renders import page sections', async () => {
    renderWithProviders(<ImportPage />);
    expect(screen.getByRole('heading', { name: /История импорта/i })).toBeInTheDocument();
  });
});
