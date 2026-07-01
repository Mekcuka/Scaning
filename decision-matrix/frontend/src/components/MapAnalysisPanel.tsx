import { useMemo } from 'react';
import type { ColumnsType } from 'antd/es/table';
import { Button, Card } from 'antd';
import type { AnalysisResult, AnalysisRow, POI } from '../lib/api';
import {
  formatAnalysisKm,
  groupAnalysisRows,
  rowCostMln,
  statusLabelRu,
  subtypeDisplayLabel,
} from '../lib/analysisDisplay';
import { AppDataTable } from './AppDataTable';

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
  const { external } = groupAnalysisRows(rows);

  const columns = useMemo<ColumnsType<AnalysisRow>>(
    () => [
      {
        title: 'Подтип',
        key: 'subtype',
        className: 'font-medium whitespace-nowrap',
        render: (_, row) => subtypeDisplayLabel(row.subtype),
      },
      {
        title: 'Объект',
        key: 'object_name',
        className: 'max-w-[72px] truncate',
        render: (_, row) => row.object_name || '—',
        onCell: (row) => ({ title: row.object_name || undefined }),
      },
      {
        title: 'км',
        key: 'distance_km',
        align: 'right',
        width: 36,
        className: 'tabular-nums',
        render: (_, row) => formatAnalysisKm(row.distance_km),
      },
      {
        title: 'Лим',
        key: 'limit_km',
        align: 'right',
        width: 36,
        className: 'tabular-nums',
        render: (_, row) => formatAnalysisKm(row.limit_km),
      },
      {
        title: 'Статус',
        key: 'status',
        render: (_, row) => {
          const delta =
            row.status === 'exceeds_limit' && row.distance_km != null && row.limit_km != null
              ? row.distance_km - row.limit_km
              : null;
          const cost = rowCostMln(row, rawAnalysisItems);
          const canPick = row.status !== 'not_required';
          return (
            <div className="flex items-center justify-between gap-1 min-w-0">
              <span className="truncate" title={statusShort(row.status, delta)}>
                {statusShort(row.status, delta)}
                {cost != null && cost > 0 ? (
                  <span style={{ color: 'var(--text-muted)' }}> · {cost}</span>
                ) : null}
              </span>
              {canPick && (
                <Button
                  type="link"
                  size="small"
                  className="shrink-0 whitespace-nowrap !text-[10px] !h-auto !p-0"
                  onClick={() => onPickCandidate(row.subtype)}
                >
                  Другой
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    [onPickCandidate, rawAnalysisItems],
  );

  if (isAnalyzing || rows.length === 0) return null;
  if (external.length === 0) return null;

  return (
    <Card
      size="small"
      className="map-analysis-panel"
      classNames={{
        body: 'p-2 text-[11px] leading-tight max-h-[min(50vh,360px)] overflow-auto',
      }}
      style={{ borderColor: 'var(--border)' }}
    >
      <div
        className="font-semibold uppercase tracking-wide mb-1.5 px-0.5"
        style={{ color: 'var(--text-muted)', fontSize: '10px' }}
      >
        Внешние
      </div>
      <AppDataTable
        className="map-analysis-compact w-full -mx-0.5"
        rowKey="subtype"
        columns={columns}
        dataSource={external}
      />
    </Card>
  );
}
