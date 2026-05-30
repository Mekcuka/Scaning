import type { AnalysisRow } from '../../../lib/api';
import { formatRowLine, groupAnalysisRows, statusClass, statusLabel } from '../reportUtils';

type Props = {
  rows: AnalysisRow[];
  poiName?: string;
};

export function OnePagerSubtypeTable({ rows, poiName }: Props) {
  const { internal, external } = groupAnalysisRows(rows);

  return (
    <div className="one-pager-variant">
      {poiName && (
        <h3 className="one-pager-section-title">Точка интереса: {poiName}</h3>
      )}
      <div className="one-pager-variant-grid">
        <div>
          <strong>Внутренние (Inside POI)</strong>
          <ul className="one-pager-variant-list">
            {internal.length === 0 && <li className="one-pager-variant-item text-muted">Нет данных</li>}
            {internal.map((row) => {
              const line = formatRowLine(row);
              return (
                <li key={row.subtype} className="one-pager-variant-item">
                  <span>{line.main}</span>
                  <span className={`status ${statusClass(row.status)}`}>{statusLabel(row.status)}</span>
                  <span className="tabular">{line.sub}</span>
                </li>
              );
            })}
          </ul>
        </div>
        <div>
          <strong>Внешние (Outside POI)</strong>
          <ul className="one-pager-variant-list">
            {external.length === 0 && <li className="one-pager-variant-item text-muted">Нет данных</li>}
            {external.map((row) => {
              const line = formatRowLine(row);
              return (
                <li key={row.subtype} className="one-pager-variant-item">
                  <span>{line.main}</span>
                  <span className={`status ${statusClass(row.status)}`}>{statusLabel(row.status)}</span>
                  <span className="tabular">{line.sub}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
