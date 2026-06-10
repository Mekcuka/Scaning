import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PoiParamsForm } from './PoiParamsForm';
import { PoiCreateForm } from './PoiCreateForm';
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

describe('PoiCreateForm', () => {
  it('renders compact create layout without threshold accordions', () => {
    render(
      <PoiCreateForm
        value={emptyPoiFormValues({ name: 'Точка_1' })}
        onChange={() => {}}
      />,
    );
    expect(screen.getByDisplayValue('Точка_1')).toBeInTheDocument();
    expect(document.querySelector('.poi-create-form__coords')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Основное' })).toBeInTheDocument();
    expect(document.getElementById('poi-create-production')).toHaveTextContent('Параметры добычи');
    expect(screen.getAllByText('тыс. т/год').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /инженерные параметры/i })).toBeInTheDocument();
    expect(screen.queryByText('Пороги до внешних объектов')).not.toBeInTheDocument();
  });
});
