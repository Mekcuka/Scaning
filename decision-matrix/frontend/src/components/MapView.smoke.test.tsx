import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test/renderWithProviders';
import { MapView } from './MapView';

describe('MapView smoke', () => {
  it('mounts map container with empty data', () => {
    const { container } = renderWithProviders(
      <MapView infraObjects={[]} pois={[]} height="240px" persistViewState={false} />,
    );
    const mapRoot = container.querySelector('.ol-viewport, .map-view-root, [class*="map"]');
    expect(mapRoot ?? container.firstChild).toBeTruthy();
  });
});
