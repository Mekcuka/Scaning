import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { FlowSchematicProvider } from '../flowSchematicContext';
import { FlowEconomicPage } from '../FlowEconomicPage';
import { renderPage } from '../../../test/pages/renderPage';
import type { FlowSchematicContextValue } from '../flowSchematicContext';

vi.mock('../../../components/EconomicFlowSchematic', () => ({
  EconomicFlowSchematic: () => <div data-testid="mock-economic-flow" />,
}));

function makeFlowCtx(overrides: Partial<FlowSchematicContextValue> = {}): FlowSchematicContextValue {
  return {
    projectId: 'p1',
    pois: [],
    poisLoading: false,
    activePoiId: 'poi-1',
    setSelectedPoiId: vi.fn(),
    schematicQuery: {
      data: { nodes: [], edges: [], source: 'computed', warnings: [] },
      isLoading: false,
      isError: false,
    } as never,
    economicQuery: {
      data: { nodes: [], edges: [] },
      isLoading: false,
      isError: false,
    } as never,
    schematicEditorKey: 'k',
    needsNetwork: false,
    saveMut: { mutate: vi.fn(), isPending: false } as never,
    persistSchematicMut: { mutate: vi.fn(), isPending: false } as never,
    poiProductionMut: { mutate: vi.fn(), isPending: false } as never,
    resetMut: { mutate: vi.fn(), isPending: false } as never,
    ...overrides,
  };
}

describe('FlowEconomicPage', () => {
  it('renders economic schematic', () => {
    renderPage(
      <FlowSchematicProvider value={makeFlowCtx()}>
        <FlowEconomicPage />
      </FlowSchematicProvider>,
    );
    expect(screen.getByText(/Денежные потоки/)).toBeInTheDocument();
    expect(screen.getByTestId('mock-economic-flow')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    renderPage(
      <FlowSchematicProvider
        value={makeFlowCtx({
          economicQuery: { data: undefined, isLoading: true, isError: false } as never,
        })}
      >
        <FlowEconomicPage />
      </FlowSchematicProvider>,
    );
    expect(screen.getByText('Загрузка…')).toBeInTheDocument();
  });
});
