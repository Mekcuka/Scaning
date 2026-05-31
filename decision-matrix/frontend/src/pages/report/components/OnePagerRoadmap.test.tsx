import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import { OnePagerRoadmap } from './OnePagerRoadmap';
import { renderPage } from '../../../test/pages/renderPage';
import { DEFAULT_ROADMAP } from '../reportUtils';

describe('OnePagerRoadmap', () => {
  afterEach(() => cleanup());

  it('renders roadmap stages', () => {
    renderPage(
      <OnePagerRoadmap
        roadmap={DEFAULT_ROADMAP}
        readOnly={false}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Разведка')).toBeInTheDocument();
  });

  it('renders read-only mode', () => {
    renderPage(
      <OnePagerRoadmap roadmap={DEFAULT_ROADMAP} readOnly onChange={vi.fn()} />,
    );
    expect(screen.getByRole('img', { name: /дорожная карта/i })).toBeInTheDocument();
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  });
});
