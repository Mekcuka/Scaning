import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ImportWellSurveysSection } from './ImportWellSurveysSection';

describe('ImportWellSurveysSection', () => {
  it('renders survey import section', () => {
    render(
      <ImportWellSurveysSection
        readOnly={false}
        hasProjects
        padOptions={[{ id: 'p1', name: 'Куст-1', subtype: 'oil_pad' }]}
        padId=""
        setPadId={vi.fn()}
        fileInputRef={{ current: null }}
        preview={null}
        format={null}
        useAsync={false}
        setUseAsync={vi.fn()}
        interpolate
        setInterpolate={vi.fn()}
        busy={false}
        asyncThreshold={20}
        onFile={vi.fn()}
        onCommit={vi.fn()}
      />,
    );
    expect(screen.getByText('Импорт инклинометрии')).toBeInTheDocument();
    expect(screen.getByText(/WITSML — скоро/)).toBeInTheDocument();
  });
});
