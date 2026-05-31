import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { FlowSchematicProvider } from './flowSchematicContext';
import { FlowLogisticsPage } from './FlowLogisticsPage';
import { renderPage } from '../../test/pages/renderPage';
import type { FlowSchematicContextValue } from './flowSchematicContext';

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

vi.mock('../../lib/sandLogisticsResult', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/sandLogisticsResult')>();
  return {
    ...actual,
    loadSandLogisticsFromSession: vi.fn().mockResolvedValue(null),
    loadActiveSubnetIndex: vi.fn(() => 0),
    saveActiveSubnetIndex: vi.fn(),
    saveSandLogisticsToSession: vi.fn(),
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

});
