import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { FlowSchematicProvider } from './flowSchematicContext';
import { FlowLogisticsPage } from './FlowLogisticsPage';
import { renderPage } from '../../test/pages/renderPage';
import type { FlowSchematicContextValue } from './flowSchematicContext';
import { useProjectSandLogistics } from '../../hooks/useProjectSandLogistics';
import { complexSandLogisticsResult } from '../../test/fixtures/sandLogisticsFixtures';

function makeFlowCtx(overrides: Partial<FlowSchematicContextValue> = {}): FlowSchematicContextValue {
  return {
    projectId: 'p1',
    pois: [],
    poisLoading: false,
    activePoiId: '',
    setSelectedPoiId: vi.fn(),
    schematicQuery: { data: undefined, isLoading: false, isError: false } as never,
    economicQuery: { data: undefined, isLoading: false, isError: false } as never,
    schematicEditorKey: 'k',
    needsNetwork: false,
    saveMut: { mutate: vi.fn(), isPending: false } as never,
    persistSchematicMut: { mutate: vi.fn(), isPending: false } as never,
    poiProductionMut: { mutate: vi.fn(), isPending: false } as never,
    resetMut: { mutate: vi.fn(), isPending: false } as never,
    ...overrides,
  };
}

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

vi.mock('../../lib/sandLogisticsResult', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/sandLogisticsResult')>();
  return {
    ...actual,
    loadActiveSubnetIndex: vi.fn(() => 0),
    saveActiveSubnetIndex: vi.fn(),
    loadSandLogisticsHorizonTo: vi.fn(() => '2026-12-31'),
    loadSandLogisticsViewAsOf: vi.fn(() => '2023-12-31'),
  };
});

describe('FlowLogisticsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows hint when no sand logistics result', () => {
    renderPage(
      <FlowSchematicProvider value={makeFlowCtx()}>
        <FlowLogisticsPage />
      </FlowSchematicProvider>,
    );
    expect(screen.getByRole('button', { name: /Рассчитать логистику песка/i })).toBeInTheDocument();
  });

  it('renders saved result with warnings and multiple subnets without error boundary', async () => {
    vi.mocked(useProjectSandLogistics).mockReturnValue({
      data: complexSandLogisticsResult(),
      isLoading: false,
      isSuccess: true,
      isError: false,
    } as never);

    renderPage(
      <FlowSchematicProvider value={makeFlowCtx()}>
        <FlowLogisticsPage />
      </FlowSchematicProvider>,
    );

    expect(screen.queryByRole('heading', { name: /Произошла ошибка/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Общие предупреждения/i)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Подсеть 1/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Подсеть 2/i })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/Схема движения песка/i)).toBeInTheDocument();
    });
  });
});
