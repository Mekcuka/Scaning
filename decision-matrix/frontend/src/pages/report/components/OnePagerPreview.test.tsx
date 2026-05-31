import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import { OnePagerPreview } from './OnePagerPreview';
import { renderPage } from '../../../test/pages/renderPage';
import { makePoi } from '../../../test/fixtures/map';

vi.mock('../../../components/MapView', () => ({
  MapView: () => <div data-testid="mock-map-view" />,
}));

vi.mock('../../../components/MapView3D', () => ({
  default: () => <div data-testid="mock-3d" />,
}));

vi.mock('../../../lib/map3d/map3dConfig', () => ({
  isMap3dEnabled: () => false,
}));

describe('OnePagerPreview', () => {
  afterEach(() => cleanup());

  it('renders preview title', () => {
    const poi = makePoi();
    renderPage(
      <OnePagerPreview
        data={{
          title: 'One-pager Test',
          poiName: poi.name,
          analysisRows: [],
          poi,
          roadmap: [],
          recommendationText: 'Recommendation text',
        }}
        pois={[poi]}
        infraObjects={[]}
        layers={[]}
        connectionLines={[]}
        mapFocus={null}
        selectedPoi={poi}
      />,
    );
    expect(screen.getByText('One-pager Test')).toBeInTheDocument();
  });
});
