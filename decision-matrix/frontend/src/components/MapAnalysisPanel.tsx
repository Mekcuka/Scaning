import type { AnalysisResult, AnalysisRow, POI } from '../lib/api';
import {
  formatAnalysisKm,
  groupAnalysisRows,
  rowCostMln,
  statusLabelRu,
  subtypeDisplayLabel,
} from '../lib/analysisDisplay';

type Props = {
  rows: AnalysisRow[];
  summary: Pick<AnalysisResult, 'total_cost_mln' | 'overall_status'> | null;
  rawAnalysisItems: Record<string, unknown>[];
  poi: POI | null;
  isAnalyzing: boolean;
  onPickCandidate: (subtype: string) => void;
};

function statusShort(status: string, delta?: number | null): string {
  if (status === 'exceeds_limit' && delta != null) {
    return `+${delta.toFixed(1)} км`;
  }
  return statusLabelRu(status);
}

export function MapAnalysisPanel({
  rows,
  rawAnalysisItems,
  isAnalyzing,
  onPickCandidate,
}: Props) {
  if (isAnalyzing || rows.length === 0) return null;

  const { external } = groupAnalysisRows(rows);
  if (external.length === 0) return null;

  return (
    <div
      className="card p-2 text-[11px] leading-tight max-h-[min(50vh,360px)] overflow-auto"
      style={{ borderColor: 'var(--border)' }}
    >
      <div
        className="font-semibold uppercase tracking-wide mb-1.5 px-0.5"
        style={{ color: 'var(--text-muted)', fontSize: '10px' }}
      >
        Внешние
      </div>
      <div className="table-wrap -mx-0.5">
        <table className="data-table map-analysis-compact w-full">
          <thead>
            <tr>
              <th>Подтип</th>
              <th>Объект</th>
              <th className="text-right w-9">км</th>
              <th className="text-right w-9">Лим</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {external.map((row) => {
              const delta =
                row.status === 'exceeds_limit' && row.distance_km != null && row.limit_km != null
                  ? row.distance_km - row.limit_km
                  : null;
              const cost = rowCostMln(row, rawAnalysisItems);
              const canPick = row.status !== 'not_required';
              return (
                <tr key={row.subtype}>
                  <td className="font-medium whitespace-nowrap">{subtypeDisplayLabel(row.subtype)}</td>
                  <td className="max-w-[72px] truncate" title={row.object_name || undefined}>
                    {row.object_name || '—'}
                  </td>
                  <td className="text-right tabular-nums">{formatAnalysisKm(row.distance_km)}</td>
                  <td className="text-right tabular-nums">{formatAnalysisKm(row.limit_km)}</td>
                  <td>
                    <div className="flex items-center justify-between gap-1 min-w-0">
                      <span className="truncate" title={statusShort(row.status, delta)}>
                        {statusShort(row.status, delta)}
                        {cost != null && cost > 0 ? (
                          <span style={{ color: 'var(--text-muted)' }}> · {cost}</span>
                        ) : null}
                      </span>
                      {canPick && (
                        <button
                          type="button"
                          className="shrink-0 text-blue-600 hover:underline whitespace-nowrap"
                          style={{ fontSize: '10px' }}
                          onClick={() => onPickCandidate(row.subtype)}
                        >
                          Другой
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
