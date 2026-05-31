import type { ReactElement } from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderPage } from './renderPage';
import { seedAppStore } from './seedAppStore';
import type { MapViewProps } from '../../components/MapView';

function mapState() {
  return globalThis.__mapPageTestState;
}

export function resetMapDisplayMode() {
  mapState().displayMode = '2d';
}

export async function renderMapPage(ui: ReactElement, route = '/map') {
  resetMapDisplayMode();
  seedAppStore({ currentProjectId: 'p1' });
  const result = renderPage(ui, { route });
  await waitFor(() => {
    expect(screen.getByTestId('mock-map-view')).toBeInTheDocument();
  });
  return result;
}

export function getMapViewProps(): MapViewProps {
  const props = mapState().mapViewProps;
  if (!props) throw new Error('MapView props not set — render MapPage first');
  return props;
}

export async function enableMapEdit() {
  const btn = await screen.findByRole('button', { name: /включить редактирование/i });
  await userEvent.click(btn);
}
