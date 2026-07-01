import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PadClusteringSummaryTable } from './PadClusteringSummaryTable';
import type { TransposedSummaryTable } from '../../lib/padClusteringSummaryRows';

const table: TransposedSummaryTable = {
  columns: [
    { kind: 'single', key: 'Роль', label: 'Роль' },
    { kind: 'single', key: 'Тип', label: 'Тип' },
    { kind: 'single', key: 'TVD, м', label: 'TVD, м' },
  ],
  paramLabels: ['Роль', 'Тип', 'TVD, м'],
  rows: [
    {
      key: 'a',
      label: 'Забой · A',
      values: { 'Роль': 'Основной', 'Тип': 'ГС', 'TVD, м': '1 500' },
    },
    {
      key: 'b',
      label: 'Забой · B',
      values: { 'Роль': 'Основной', 'Tип': 'ГС', 'TVD, м': '1 200' },
    },
    {
      key: 'c',
      label: 'Доп.ствол · C',
      values: { 'Роль': 'Доп.ствол', 'Tип': 'ГС', 'TVD, м': '900' },
    },
  ],
};

describe('PadClusteringSummaryTable', () => {
  it('sorts rows without changing count when labels repeat', async () => {
    const duplicateLabelTable: TransposedSummaryTable = {
      ...table,
      rows: [
        ...table.rows,
        {
          key: 'd',
          label: 'Забой · A',
          values: { 'Роль': 'Основной', 'Tип': 'ГС', 'TVD, м': '2 000' },
        },
      ],
    };
    const user = userEvent.setup();
    render(
      <PadClusteringSummaryTable title="Забои" table={duplicateLabelTable} rowHeaderLabel="Объект" />,
    );

    expect(screen.getAllByRole('row')).toHaveLength(5);

    await user.click(screen.getByRole('button', { name: /TVD, м/i }));
    expect(screen.getAllByRole('row')).toHaveLength(5);

    const bodyRows = screen.getAllByRole('row').slice(1);
    expect(bodyRows[0]).toHaveTextContent('Доп.ствол · C');
    expect(bodyRows[bodyRows.length - 1]).toHaveTextContent('2 000');
  });

  it('renders column filters in every header', () => {
    render(<PadClusteringSummaryTable title="Забои" table={table} rowHeaderLabel="Объект" />);
    // Ant Table may duplicate header cells for fixed-column scroll sync.
    for (const label of ['Объект', 'Роль', 'TVD, м'] as const) {
      expect(screen.getAllByLabelText(`Фильтр: ${label}`).length).toBeGreaterThanOrEqual(1);
    }
  });
});
