import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import { OnePagerSubtypeTable } from './OnePagerSubtypeTable';
import { renderPage } from '../../../test/pages/renderPage';

describe('OnePagerSubtypeTable', () => {
  afterEach(() => cleanup());

  it('renders internal and external sections', () => {
    renderPage(
      <OnePagerSubtypeTable
        poiName="POI Alpha"
        rows={[
          {
            subtype: 'gas_processing',
            object_name: 'GKS-1',
            status: 'within_limit',
            param_type: 'internal',
          },
          {
            subtype: 'autoroad',
            object_name: 'Road',
            status: 'exceeds_limit',
            param_type: 'external',
          },
        ] as never}
      />,
    );
    expect(screen.getByText(/внутренние/i)).toBeInTheDocument();
    expect(screen.getByText(/внешние/i)).toBeInTheDocument();
  });
});
