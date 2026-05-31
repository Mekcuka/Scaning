import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { FlowSchematicLayout } from './FlowSchematicLayout';
import { FlowTechnologyPage } from './FlowTechnologyPage';
import { renderPage } from '../../test/pages/renderPage';
import { seedAppStore } from '../../test/pages/seedAppStore';
import { api } from '../../lib/api';

vi.mock('../../lib/api', async (importOriginal) => {
  const { createApiMock } = await import('../../test/pages/apiMockModule');
  return createApiMock(importOriginal);
});
vi.mock('../../components/FlowSchematicEditor', () => ({
  FlowSchematicEditor: () => <div data-testid="mock-flow-editor" />,
}));

describe('FlowSchematicLayout', () => {
  beforeEach(() => {
    seedAppStore({ currentProjectId: 'p1' });
    vi.mocked(api.getFlowSchematic).mockResolvedValue({
      nodes: [],
      edges: [],
      source: 'computed',
      warnings: [],
    } as never);
    vi.mocked(api.getEconomicFlowSchematic).mockResolvedValue({
      nodes: [],
      edges: [],
    } as never);
  });

  it('renders flow tabs and outlet', async () => {
    renderPage(
      <Routes>
        <Route path="/flows" element={<FlowSchematicLayout />}>
          <Route path="technology" element={<FlowTechnologyPage />} />
        </Route>
      </Routes>,
      { initialEntries: ['/flows/technology'] },
    );
    await waitFor(() =>
      expect(screen.getByText('Технологический поток')).toBeInTheDocument(),
    );
    expect(await screen.findByTestId('mock-flow-editor')).toBeInTheDocument();
  });
});
