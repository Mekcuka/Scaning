import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MapLayersPanel } from './MapLayersPanel';

const baseProps = {
  layers: [],
  isGroupVisible: () => true,
  onGroupVisibility: vi.fn(),
  onLayerVisibility: vi.fn(),
  showPoisOnMap: true,
  onShowPoisChange: vi.fn(),
  showRadii: true,
  onShowRadiiChange: vi.fn(),
  radiusVisible: {},
  onRadiusVisibleChange: vi.fn(),
  thresholdMeta: [],
  thresholdKm: () => 0,
  showBasemap: true,
  onShowBasemapChange: vi.fn(),
};

describe('MapLayersPanel', () => {
  it('shows only satellite basemap toggle in 2D (no 3D layer handlers)', () => {
    render(<MapLayersPanel {...baseProps} />);
    expect(screen.getByText('Спутник')).toBeInTheDocument();
    expect(screen.queryByText('Рельеф (3D)')).not.toBeInTheDocument();
    expect(screen.queryByText('3D-модели объектов')).not.toBeInTheDocument();
  });

  it('shows 3D models toggle when handler provided', () => {
    render(
      <MapLayersPanel
        {...baseProps}
        showModels
        onShowModelsChange={vi.fn()}
        modelsToggleEnabled
      />,
    );
    expect(screen.queryByText('Рельеф (3D)')).not.toBeInTheDocument();
    expect(screen.getByText('3D-модели объектов')).toBeInTheDocument();
  });
});
