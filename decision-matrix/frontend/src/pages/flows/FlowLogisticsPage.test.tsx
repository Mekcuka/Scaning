import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, cleanup } from '@testing-library/react';
import { FlowLogisticsPage } from './FlowLogisticsPage';
import { renderPage } from '../../test/pages/renderPage';
import { seedAppStore } from '../../test/pages/seedAppStore';
import { useProjectSandLogistics } from '../../hooks/useProjectSandLogistics';
import { complexSandLogisticsResult } from '../../test/fixtures/sandLogisticsFixtures';

vi.mock('../../lib/api', async (importOriginal) => {
  const { createApiMock } = await import('../../test/pages/apiMockModule');
  return createApiMock(importOriginal);
});

vi.mock('../../hooks/useProjectSandLogistics', () => ({
  useProjectSandLogistics: vi.fn(() => ({
    data: null,
    isLoading: false,
    isSuccess: true,
  })),
}));

vi.mock('../../components/logistics/SandLogisticsFlowSchematic', () => ({
  SandLogisticsFlowSchematic: () => null,
}));

vi.mock('../../lib/sandLogisticsResult', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/sandLogisticsResult')>();
  return {
    ...actual,
    loadActiveSubnetIndex: vi.fn(() => 0),
    saveActiveSubnetIndex: vi.fn(),
    loadSandLogisticsHorizonTo: vi.fn(() => '2026-12-31'),
    loadSandLogisticsViewAsOf: vi.fn(() => '2023-12-31'),
    prefetchSchematicSubnetsAtView: vi.fn(),
  };
});

describe('FlowLogisticsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seedAppStore({ currentProjectId: 'p1' });
  });

  afterEach(() => {
    cleanup();
  });

  it('shows hint when no sand logistics result', () => {
    renderPage(<FlowLogisticsPage />);
    expect(screen.getByRole('button', { name: /Рассчитать логистику песка/i })).toBeInTheDocument();
  });

  it('renders saved result with warnings and multiple subnets without error boundary', async () => {
    vi.mocked(useProjectSandLogistics).mockReturnValue({
      data: complexSandLogisticsResult(),
      isLoading: false,
      isSuccess: true,
      isError: false,
    } as never);

    renderPage(<FlowLogisticsPage />);

    expect(screen.queryByRole('heading', { name: /Произошла ошибка/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Общие предупреждения/i)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Подсеть 1/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Подсеть 2/i })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/Схема движения песка/i)).toBeInTheDocument();
    });
  });
});
