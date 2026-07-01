import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { FlowSchematicProvider } from '../flowSchematicContext';
import { FlowTechnologyPage } from '../FlowTechnologyPage';
import { renderPage } from '../../../test/pages/renderPage';
import type { FlowSchematicContextValue } from '../flowSchematicContext';

vi.mock('../../../components/FlowSchematicEditor', () => ({
  FlowSchematicEditor: () => <div data-testid="mock-flow-editor" />,
}));

function makeCtx(overrides: Partial<FlowSchematicContextValue> = {}): FlowSchematicContextValue {
  return {
    projectId: 'p1',
    pois: [{ id: 'poi-1', name: 'P1' } as never],
    poisLoading: false,
    activePoiId: 'poi-1',
    setSelectedPoiId: vi.fn(),
    schematicQuery: {
      data: { nodes: [], edges: [], source: 'computed', warnings: [] },
      isLoading: false,
      isError: false,
      error: null,
    } as never,
    economicQuery: { data: undefined, isLoading: false, isError: false } as never,
    schematicEditorKey: 'k1',
    needsNetwork: false,
    saveMut: { mutate: vi.fn(), isPending: false } as never,
    persistSchematicMut: { mutate: vi.fn(), isPending: false } as never,
    poiProductionMut: { mutate: vi.fn(), isPending: false } as never,
    resetMut: { mutate: vi.fn(), isPending: false } as never,
    ...overrides,
  };
}

describe('FlowTechnologyPage', () => {
  it('renders schematic editor when data loaded', () => {
    renderPage(
      <FlowSchematicProvider value={makeCtx()}>
        <FlowTechnologyPage />
      </FlowSchematicProvider>,
    );
    expect(screen.getByText(/PFD/)).toBeInTheDocument();
    expect(screen.getByTestId('mock-flow-editor')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    renderPage(
      <FlowSchematicProvider value={makeCtx({ schematicQuery: { isLoading: true, isError: false } as never })}>
        <FlowTechnologyPage />
      </FlowSchematicProvider>,
    );
    expect(screen.getByText('Загрузка схемы…')).toBeInTheDocument();
  });
});
