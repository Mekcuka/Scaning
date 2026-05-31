import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { ParametersPage } from './ParametersPage';
import { renderWithProviders } from '../test/renderWithProviders';
import { useAppStore } from '../store';

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      getInfraObjects: vi.fn().mockResolvedValue([]),
    },
  };
});

vi.mock('../hooks/usePermissions', () => ({
  usePermissions: () => ({ canWriteProject: true }),
}));

describe('ParametersPage smoke', () => {
  beforeEach(() => {
    useAppStore.setState({ currentProjectId: 'p1', pushToast: vi.fn() });
  });

  it('renders heading when project is selected', async () => {
    renderWithProviders(<ParametersPage />);
    expect(screen.getByText('Открыть карту')).toBeInTheDocument();
    expect(screen.getByText('Пропускная способность')).toBeInTheDocument();
  });
});
