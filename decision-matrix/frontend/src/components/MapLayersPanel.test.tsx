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

  it('shows bottomhole and trajectory categories when handlers provided', () => {
    render(
      <MapLayersPanel
        {...baseProps}
        openSections={{ basemap: false, objects: true, sources: false, radii: false }}
        onShowWellTrajectoriesChange={vi.fn()}
        onShowWellBottomholesChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Забои')).toBeInTheDocument();
    expect(screen.getByText('Забой (ННБ)')).toBeInTheDocument();
    expect(screen.getByText('Траектории')).toBeInTheDocument();
    expect(screen.getByText('План (2D)')).toBeInTheDocument();
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

  it('shows 3D quality presets when handler provided', () => {
    render(
      <MapLayersPanel
        {...baseProps}
        showModels
        onShowModelsChange={vi.fn()}
        modelsToggleEnabled
        map3dQuality="balanced"
        onMap3dQualityChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Качество 3D')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Стандарт' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('Рекомендуется для повседневной работы. Модели не меняются.')).toBeInTheDocument();
  });

  it('hides 3D quality when models are off', () => {
    render(
      <MapLayersPanel
        {...baseProps}
        showModels={false}
        onShowModelsChange={vi.fn()}
        modelsToggleEnabled
        map3dQuality="balanced"
        onMap3dQualityChange={vi.fn()}
      />,
    );
    expect(screen.queryByText('Качество 3D')).not.toBeInTheDocument();
  });
});
