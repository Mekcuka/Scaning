import { describe, expect, it, vi, afterEach } from 'vitest';
import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { SandLogisticsSubnetPanel } from './SandLogisticsSubnetPanel';
import { renderPage } from '../../test/pages/renderPage';
import { FlowSchematicProvider } from '../../pages/flows/flowSchematicContext';
import type { FlowSchematicContextValue } from '../../pages/flows/flowSchematicContext';
import {
  complexSandLogisticsResult,
  mainQuarrySubnet,
  waitingOffNetworkSubnet,
} from '../../test/fixtures/sandLogisticsFixtures';
import { resolveSubnetForSchematicAtView } from '../../lib/sandLogisticsResult';

function makeFlowCtx(): FlowSchematicContextValue {
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
  };
}

describe('SandLogisticsSubnetPanel', () => {
  const result = complexSandLogisticsResult();

  afterEach(() => {
    cleanup();
  });

  it('renders main subnet with schematic and tables', () => {
    renderPage(
      <FlowSchematicProvider value={makeFlowCtx()}>
        <SandLogisticsSubnetPanel
          subnet={mainQuarrySubnet()}
          result={result}
          viewAsOf="2023-12-31"
        />
      </FlowSchematicProvider>,
    );

    expect(screen.getByRole('heading', { name: /Схема движения песка/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Карьеры/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Потребители/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Карьер песка_2/i).length).toBeGreaterThan(0);
  });

  it('renders waiting subnet warnings without crashing', () => {
    renderPage(
      <FlowSchematicProvider value={makeFlowCtx()}>
        <SandLogisticsSubnetPanel
          subnet={waitingOffNetworkSubnet()}
          result={result}
          viewAsOf="2019-12-31"
        />
      </FlowSchematicProvider>,
    );

    expect(screen.getByRole('heading', { name: /Подсеть 2: ГКС_3/i })).toBeInTheDocument();
    expect(screen.getByText(/Неудовлетворённый спрос: ГКС_3/i)).toBeInTheDocument();
    expect(screen.queryByText(/Не удалось построить схему/i)).not.toBeInTheDocument();
  });

  it('keeps schematic visible when line style changes', async () => {
    const user = userEvent.setup();
    renderPage(
      <FlowSchematicProvider value={makeFlowCtx()}>
        <SandLogisticsSubnetPanel
          subnet={mainQuarrySubnet()}
          result={result}
          viewAsOf="2023-12-31"
        />
      </FlowSchematicProvider>,
    );

    await waitFor(() => {
      expect(screen.getAllByText(/Карьер песка_2/i).length).toBeGreaterThan(0);
    });

    const lineStyleTrigger = screen.getByRole('button', { name: /Форма линий на схеме/i });
    for (const label of ['Изгибы', 'Ступеньки', 'Прямые']) {
      await user.click(lineStyleTrigger);
      await user.click(screen.getByRole('option', { name: label }));
    }

    expect(screen.queryByText(/Не удалось построить схему/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/Карьер песка_2/i).length).toBeGreaterThan(0);
    expect(document.querySelector('.react-flow__node')).not.toBeNull();
  });

  it('renders complex result main subnet without schematic error boundary', () => {
    const complex = complexSandLogisticsResult();
    renderPage(
      <FlowSchematicProvider value={makeFlowCtx()}>
        <SandLogisticsSubnetPanel
          canonicalSubnet={complex.subnets[0]!}
          sliceSubnet={complex.subnets[0]!}
          result={complex}
          viewAsOf="2023-12-31"
        />
      </FlowSchematicProvider>,
    );

    expect(screen.queryByText(/Не удалось построить схему/i)).not.toBeInTheDocument();
    expect(document.querySelector('.react-flow__node')).not.toBeNull();
  });

  it('keeps schematic mounted when view year changes', async () => {
    const user = userEvent.setup();
    const complex = complexSandLogisticsResult();
    const canonical = complex.subnets[0]!;

    function YearSwitchPanel() {
      const [viewAsOf, setViewAsOf] = useState('2019-12-31');
      const sliceSubnet = resolveSubnetForSchematicAtView(complex, canonical, viewAsOf);
      return (
        <SandLogisticsSubnetPanel
          canonicalSubnet={canonical}
          sliceSubnet={sliceSubnet}
          result={complex}
          viewAsOf={viewAsOf}
          onViewAsOfChange={setViewAsOf}
        />
      );
    }

    renderPage(
      <FlowSchematicProvider value={makeFlowCtx()}>
        <YearSwitchPanel />
      </FlowSchematicProvider>,
    );

    await waitFor(() => {
      expect(document.querySelector('.react-flow__node')).not.toBeNull();
    });

    await user.click(screen.getByRole('tab', { name: '2023' }));

    await waitFor(() => {
      expect(document.querySelector('.react-flow__node')).not.toBeNull();
    });
    expect(screen.queryByText(/Не удалось построить схему/i)).not.toBeInTheDocument();
  });
});
