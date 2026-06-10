import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PoiParamsForm } from './PoiParamsForm';
import { emptyPoiFormValues } from '../../lib/poiParams';

describe('PoiParamsForm', () => {
  it('renders flat basic section in object detail panel mode', () => {
    render(
      <PoiParamsForm
        value={emptyPoiFormValues()}
        onChange={() => {}}
        flat
        sections={['basic']}
      />,
    );
    expect(screen.getByText('Параметры добычи')).toBeTruthy();
    expect(screen.getByText('Флюид')).toBeTruthy();
    expect(screen.getByText('Нефть')).toBeTruthy();
  });

  it('exports barrel from components/PoiParamsForm', async () => {
    const barrel = await import('../PoiParamsForm');
    expect(barrel.PoiParamsForm).toBe(PoiParamsForm);
  });
});
