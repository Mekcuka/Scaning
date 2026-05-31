import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { OnePagerRecommendation } from './OnePagerRecommendation';
import { renderPage } from '../../../test/pages/renderPage';

describe('OnePagerRecommendation', () => {
  it('renders recommendation text', () => {
    renderPage(
      <OnePagerRecommendation value="Test recommendation" onChange={() => {}} readOnly={false} />,
    );
    expect(screen.getByDisplayValue('Test recommendation')).toBeInTheDocument();
  });
});
