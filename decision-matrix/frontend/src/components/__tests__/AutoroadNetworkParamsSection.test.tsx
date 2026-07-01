import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AutoroadNetworkParamsSection } from '../AutoroadNetworkParamsSection';
import { DEFAULT_AUTOROAD_PLANNER_OPTIONS } from '../../lib/autoroadNetworkPlannerOptions';

function expandParamsSection() {
  fireEvent.click(screen.getByRole('button', { name: /Параметры расчёта/i, expanded: false }));
}

describe('AutoroadNetworkParamsSection', () => {
  it('renders common params and solver status', () => {
    render(
      <AutoroadNetworkParamsSection
        options={DEFAULT_AUTOROAD_PLANNER_OPTIONS}
        onChange={vi.fn()}
        solverStatus={{ steinerpy: true, geosteiner: false, default_solver: 'geosteiner' }}
      />,
    );
    expect(screen.getByText(/Параметры расчёта/i)).toBeInTheDocument();
    expandParamsSection();
    expect(screen.getByTitle(/SteinerPy доступен/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Длина ребра у листа/i)).toBeInTheDocument();
  });

  it('shows SteinerPy-only fields when scope is steinerpy', () => {
    render(
      <AutoroadNetworkParamsSection
        options={{ ...DEFAULT_AUTOROAD_PLANNER_OPTIONS, param_scope: 'steinerpy' }}
        onChange={vi.fn()}
        solverStatus={{ steinerpy: true, geosteiner: false, default_solver: 'geosteiner' }}
      />,
    );
    expandParamsSection();
    expect(screen.getByLabelText(/Угол примыкания/i)).toBeInTheDocument();
  });
});
