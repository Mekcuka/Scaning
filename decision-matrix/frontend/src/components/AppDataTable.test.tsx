import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppDataTable } from './AppDataTable';

type Row = { id: string; name: string };

const columns = [{ title: 'Имя', dataIndex: 'name', key: 'name' }];

describe('AppDataTable', () => {
  it('shows default empty text when no rows', () => {
    render(<AppDataTable<Row> rowKey="id" columns={columns} dataSource={[]} />);
    expect(screen.getByText('Нет данных')).toBeInTheDocument();
  });

  it('shows custom empty text', () => {
    render(
      <AppDataTable<Row>
        rowKey="id"
        emptyText="Пусто"
        columns={columns}
        dataSource={[]}
      />,
    );
    expect(screen.getByText('Пусто')).toBeInTheDocument();
  });

  it('renders toolbar with excel export button when excelExport provided', () => {
    render(
      <AppDataTable<Row>
        rowKey="id"
        columns={columns}
        dataSource={[{ id: '1', name: 'Alpha' }]}
        excelExport={{
          filename: 'table.xlsx',
          columns: [{ header: 'Имя', value: (row) => row.name }],
          rows: [{ id: '1', name: 'Alpha' }],
        }}
      />,
    );
    expect(document.querySelector('.app-data-table-toolbar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Скачать Excel' })).toBeInTheDocument();
  });

  it('renders toolbar when tableExtra provided', () => {
    render(
      <AppDataTable<Row>
        rowKey="id"
        columns={columns}
        dataSource={[]}
        tableExtra={<span>Доп. действие</span>}
      />,
    );
    expect(document.querySelector('.app-data-table-toolbar')).toBeInTheDocument();
    expect(screen.getByText('Доп. действие')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Скачать Excel' })).not.toBeInTheDocument();
  });

  it('hides toolbar when neither excelExport nor tableExtra', () => {
    render(
      <AppDataTable<Row>
        rowKey="id"
        columns={columns}
        dataSource={[{ id: '1', name: 'Alpha' }]}
      />,
    );
    expect(document.querySelector('.app-data-table-toolbar')).toBeNull();
  });
});
