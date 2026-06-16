import type { TransposedSummaryTable } from '../../lib/padClusteringSummaryRows';

type Props = {
  title: string;
  table: TransposedSummaryTable;
  emptyHint?: string;
  rowHeaderLabel?: string;
};

export function PadClusteringSummaryTable({
  title,
  table,
  emptyHint,
  rowHeaderLabel = 'Объект',
}: Props) {
  const hasRows = table.rows.length > 0;
  const hasGroupedColumns = table.columns.some((col) => col.kind === 'group');

  return (
    <section className="pad-clustering-summary__section">
      <h3 className="pad-clustering-summary__title">{title}</h3>
      <div className="pad-clustering-summary__table-wrap">
        {!hasRows ? (
          <p className="pad-clustering-summary__empty pad-clustering-section__hint">{emptyHint ?? '—'}</p>
        ) : (
          <table className="pad-clustering-table text-xs pad-clustering-summary__table pad-clustering-summary__table--transposed">
            <thead>
              {hasGroupedColumns ? (
                <>
                  <tr>
                    <th
                      scope="col"
                      rowSpan={2}
                      className="pad-clustering-summary__row-head pad-clustering-summary__row-head--corner"
                    >
                      {rowHeaderLabel}
                    </th>
                    {table.columns.map((col) =>
                      col.kind === 'single' ? (
                        <th
                          key={col.key}
                          scope="col"
                          rowSpan={2}
                          className="pad-clustering-summary__col-head"
                        >
                          {col.label}
                        </th>
                      ) : (
                        <th
                          key={col.label}
                          scope="colgroup"
                          colSpan={col.columns.length}
                          className="pad-clustering-summary__col-group"
                        >
                          {col.label}
                        </th>
                      ),
                    )}
                  </tr>
                  <tr>
                    {table.columns.flatMap((col) =>
                      col.kind === 'group'
                        ? col.columns.map((child) => (
                            <th
                              key={child.key}
                              scope="col"
                              className="pad-clustering-summary__col-subhead"
                            >
                              {child.label}
                            </th>
                          ))
                        : [],
                    )}
                  </tr>
                </>
              ) : (
                <tr>
                  <th scope="col" className="pad-clustering-summary__row-head">
                    {rowHeaderLabel}
                  </th>
                  {table.columns.map((col) =>
                    col.kind === 'single' ? (
                      <th key={col.key} scope="col" className="pad-clustering-summary__col-head">
                        {col.label}
                      </th>
                    ) : null,
                  )}
                </tr>
              )}
            </thead>
            <tbody>
              {table.rows.map((row) => (
                <tr key={row.label}>
                  <th scope="row" className="pad-clustering-summary__row-head">
                    {row.label}
                  </th>
                  {table.paramLabels.map((key) => (
                    <td key={key}>{row.values[key] ?? '—'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
