import { useMemo } from 'react';
import type { ColumnsType } from 'antd/es/table';
import { Button, Tag } from 'antd';
import type { AnalysisRow } from '../lib/api';
import {
  formatAnalysisKm,
  groupAnalysisRows,
  internalFormulaLabel,
  overallStatusBadgeClass,
  rowCostMln,
  statusLabelRu,
  subtypeDisplayLabel,
} from '../lib/analysisDisplay';
import { AppDataTable } from './AppDataTable';

type AnalysisSections =
  | 'all'
  | 'external'
  | 'externalLinear'
  | 'mapConnectivity'
  | 'internal'
  | 'pads';

type PickCandidateHandler = (
  subtype: string,
  paramType: 'external' | 'external_linear',
) => void;

type Props = {
  rows: AnalysisRow[];
  compact?: boolean;
  /** Map sidebar: only external objects. Project page: all sections. */
  sections?: AnalysisSections;
  readOnly?: boolean;
  onPickCandidate?: PickCandidateHandler;
  /** Pan map to nearest object / anchor when clicking the object name cell. */
  onFocusObject?: (row: AnalysisRow) => void;
};

function statusTagColor(status: string): string {
  const badgeClass = overallStatusBadgeClass(status);
  if (badgeClass === 'badge-success') return 'success';
  if (badgeClass === 'badge-danger') return 'error';
  if (badgeClass === 'badge-muted') return 'default';
  return 'warning';
}

function StatusTag({ status }: { status: string }) {
  return <Tag color={statusTagColor(status)}>{statusLabelRu(status)}</Tag>;
}

function ExternalObjectsTable({
  title,
  rows,
  compact,
  onPickCandidate,
  onFocusObject,
  readOnly = false,
  paramType,
}: {
  title: string;
  rows: AnalysisRow[];
  compact: boolean;
  readOnly?: boolean;
  onPickCandidate?: PickCandidateHandler;
  onFocusObject?: (row: AnalysisRow) => void;
  paramType: 'external' | 'external_linear';
}) {
  const showActions = !readOnly && !!onPickCandidate;

  const columns = useMemo<ColumnsType<AnalysisRow>>(() => {
    const cols: ColumnsType<AnalysisRow> = [
      {
        title: 'Подтип',
        key: 'subtype',
        className: 'font-medium',
        render: (_, row) => subtypeDisplayLabel(row.subtype),
      },
      {
        title: 'Объект',
        key: 'object_name',
        className: 'max-w-[120px]',
        render: (_, row) =>
          row.object_name && onFocusObject ? (
            <Button
              type="link"
              size="small"
              className="!h-auto !p-0 max-w-full truncate text-left"
              title={`Показать на карте: ${row.object_name}`}
              onClick={() => onFocusObject(row)}
            >
              {row.object_name}
            </Button>
          ) : (
            <span className="block truncate px-1" title={row.object_name || undefined}>
              {row.object_name || '—'}
            </span>
          ),
      },
      {
        title: 'км',
        key: 'distance_km',
        className: 'tabular-nums',
        render: (_, row) =>
          row.distance_km != null ? `${formatAnalysisKm(row.distance_km)} км` : '—',
      },
      {
        title: 'Лимит',
        key: 'limit_km',
        className: 'tabular-nums',
        render: (_, row) => (row.limit_km != null ? `${formatAnalysisKm(row.limit_km)} км` : '—'),
      },
      {
        title: 'Статус',
        key: 'status',
        render: (_, row) => <StatusTag status={row.status} />,
      },
      {
        title: 'млн ₽',
        key: 'cost',
        align: 'right',
        className: 'tabular-nums',
        render: (_, row) => rowCostMln(row) ?? '—',
      },
    ];

    if (showActions) {
      cols.push({
        title: '',
        key: 'actions',
        render: (_, row) => {
          if (row.status === 'not_required' || row.param_type === 'internal') return null;
          if (row.param_type !== paramType) return null;
          return (
            <Button
              type="link"
              size="small"
              className={`whitespace-nowrap !h-auto !p-0 ${compact ? '!text-[10px]' : '!text-xs'}`}
              onClick={() => onPickCandidate!(row.subtype, paramType)}
            >
              Другой
            </Button>
          );
        },
      });
    }

    return cols;
  }, [compact, onFocusObject, onPickCandidate, paramType, showActions]);

  return (
    <section>
      <h4
        className="font-semibold uppercase tracking-wide mb-1.5"
        style={{ color: 'var(--text-muted)', fontSize: compact ? '10px' : '12px' }}
      >
        {title}
      </h4>
      <AppDataTable
        className="w-full"
        rowKey={(row) => `${row.param_type}:${row.subtype}`}
        columns={columns}
        dataSource={rows}
      />
    </section>
  );
}

export function AnalysisEnvironmentTable({
  rows,
  compact = false,
  sections = 'all',
  readOnly = false,
  onPickCandidate,
  onFocusObject,
}: Props) {
  const { internal, externalLinear, external, pads } = groupAnalysisRows(rows);
  const showInternal = sections === 'all' || sections === 'internal';
  const showExternalLinear =
    sections === 'all' || sections === 'externalLinear' || sections === 'mapConnectivity';
  const showExternal =
    sections === 'all' || sections === 'external' || sections === 'mapConnectivity';
  const showPads = sections === 'all' || sections === 'pads';

  const internalColumns = useMemo<ColumnsType<AnalysisRow>>(
    () => [
      {
        title: 'Подтип',
        key: 'subtype',
        className: 'font-medium',
        render: (_, row) => subtypeDisplayLabel(row.subtype),
      },
      {
        title: 'Расчётная длина',
        key: 'distance',
        render: (_, row) => (
          <>
            <div>{formatAnalysisKm(row.distance_km)}</div>
            {internalFormulaLabel(row) && (
              <div style={{ color: 'var(--text-muted)', fontSize: compact ? '10px' : '11px' }}>
                {internalFormulaLabel(row)}
              </div>
            )}
          </>
        ),
      },
      {
        title: 'Статус',
        key: 'status',
        render: (_, row) => <StatusTag status={row.status} />,
      },
      {
        title: 'млн ₽',
        key: 'cost',
        align: 'right',
        className: 'tabular-nums',
        render: (_, row) => rowCostMln(row) ?? '—',
      },
    ],
    [compact],
  );

  const padsColumns = useMemo<ColumnsType<AnalysisRow>>(
    () => [
      {
        title: 'Подтип',
        key: 'subtype',
        className: 'font-medium',
        render: (_, row) => subtypeDisplayLabel(row.subtype),
      },
      {
        title: 'Кол-во',
        key: 'pads_count',
        render: (_, row) => row.pads_count ?? '—',
      },
      {
        title: 'Статус',
        key: 'status',
        render: (_, row) => <StatusTag status={row.status} />,
      },
      {
        title: 'млн ₽',
        key: 'cost',
        align: 'right',
        className: 'tabular-nums',
        render: (_, row) => rowCostMln(row) ?? '—',
      },
    ],
    [],
  );

  if (rows.length === 0) return null;
  if (sections === 'external' && external.length === 0) return null;
  if (sections === 'externalLinear' && externalLinear.length === 0) return null;
  if (sections === 'internal' && internal.length === 0) return null;
  if (sections === 'pads' && pads.length === 0) return null;

  const fontSize = compact ? 'text-[11px]' : 'text-sm';

  return (
    <div className={`space-y-3 ${fontSize}`}>
      {showInternal && internal.length > 0 && (
        <section>
          <h4
            className="font-semibold uppercase tracking-wide mb-1.5"
            style={{ color: 'var(--text-muted)', fontSize: compact ? '10px' : '12px' }}
          >
            Внутренние решения (удельные ставки)
          </h4>
          <AppDataTable
            className="w-full"
            rowKey="subtype"
            columns={internalColumns}
            dataSource={internal}
          />
        </section>
      )}

      {showExternalLinear && externalLinear.length > 0 && (
        <ExternalObjectsTable
          title="Внешние линейные объекты"
          rows={externalLinear}
          compact={compact}
          readOnly={readOnly}
          paramType="external_linear"
          onPickCandidate={onPickCandidate}
          onFocusObject={onFocusObject}
        />
      )}

      {showExternal && external.length > 0 && (
        <ExternalObjectsTable
          title="Внешние объекты"
          rows={external}
          compact={compact}
          readOnly={readOnly}
          paramType="external"
          onPickCandidate={onPickCandidate}
          onFocusObject={onFocusObject}
        />
      )}

      {showPads && pads.length > 0 && (
        <section>
          <h4
            className="font-semibold uppercase tracking-wide mb-1.5"
            style={{ color: 'var(--text-muted)', fontSize: compact ? '10px' : '12px' }}
          >
            Кустовые площадки
          </h4>
          <AppDataTable
            className="w-full"
            rowKey="subtype"
            columns={padsColumns}
            dataSource={pads}
          />
        </section>
      )}
    </div>
  );
}

export function AnalysisSummaryHeader({
  totalCostMln,
  overallStatus,
}: {
  totalCostMln?: number;
  overallStatus?: string;
}) {
  if (totalCostMln == null && !overallStatus) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
      <div className="flex items-center gap-2">
        <span className="font-semibold">Анализ окружения</span>
        {overallStatus && (
          <Tag color={statusTagColor(overallStatus)}>{statusLabelRu(overallStatus)}</Tag>
        )}
      </div>
      {totalCostMln != null && (
        <span className="text-lg font-bold tabular-nums">{totalCostMln} млн ₽</span>
      )}
    </div>
  );
}
