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

type AnalysisSections =
  | 'all'
  | 'external'
  | 'externalLinear'
  | 'mapConnectivity'
  | 'internal'
  | 'pads';

type PickCandidateHandler = (
  subtype: string,
  paramType: 'external' | 'external_linear'
) => void;

type ToggleConstructionHandler = (
  subtype: string,
  force: boolean,
  paramType: 'external' | 'external_linear'
) => void;

type Props = {
  rows: AnalysisRow[];
  compact?: boolean;
  /** Map sidebar: only external objects (FR-6.1.1). Project page: all sections. */
  sections?: AnalysisSections;
  onPickCandidate?: PickCandidateHandler;
  onToggleConstruction?: ToggleConstructionHandler;
  /** Pan map to nearest object / anchor when clicking the object name cell. */
  onFocusObject?: (row: AnalysisRow) => void;
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge ${overallStatusBadgeClass(status)}`}>
      {statusLabelRu(status)}
    </span>
  );
}

function ExternalObjectsTable({
  title,
  rows,
  compact,
  cellPad,
  onPickCandidate,
  onToggleConstruction,
  onFocusObject,
  paramType,
}: {
  title: string;
  rows: AnalysisRow[];
  compact: boolean;
  cellPad: string;
  onPickCandidate?: PickCandidateHandler;
  onToggleConstruction?: ToggleConstructionHandler;
  onFocusObject?: (row: AnalysisRow) => void;
  paramType: 'external' | 'external_linear';
}) {
  const renderActions = (row: AnalysisRow) => {
    if (row.status === 'not_required' || row.param_type === 'internal') return null;
    if (row.param_type !== paramType) return null;
    return (
      <div className="flex flex-col gap-0.5 items-end">
        {onPickCandidate && (
          <button
            type="button"
            className="text-blue-600 hover:underline whitespace-nowrap"
            style={{ fontSize: compact ? '10px' : '12px' }}
            onClick={() => onPickCandidate(row.subtype, paramType)}
          >
            Другой
          </button>
        )}
        {onToggleConstruction && (
          <button
            type="button"
            className="text-blue-600 hover:underline whitespace-nowrap"
            style={{ fontSize: compact ? '10px' : '12px' }}
            onClick={() => onToggleConstruction(row.subtype, !row.force_construction, paramType)}
          >
            {row.force_construction ? 'Снять стр.' : 'Своё стр.'}
          </button>
        )}
      </div>
    );
  };

  return (
    <section>
      <h4
        className="font-semibold uppercase tracking-wide mb-1.5"
        style={{ color: 'var(--text-muted)', fontSize: compact ? '10px' : '12px' }}
      >
        {title}
      </h4>
      <div className="table-wrap">
        <table className="data-table w-full">
          <thead>
            <tr>
              <th>Подтип</th>
              <th>Объект</th>
              <th>км</th>
              <th>Лимит</th>
              <th>Статус</th>
              <th className="text-right">млн ₽</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.param_type}:${row.subtype}`} className={cellPad}>
                <td className="font-medium">{subtypeDisplayLabel(row.subtype)}</td>
                <td className="max-w-[120px] p-0">
                  {row.object_name && onFocusObject ? (
                    <button
                      type="button"
                      className="w-full text-left truncate px-1 py-0.5 rounded hover:bg-[var(--bg)] text-blue-600 hover:underline cursor-pointer"
                      title={`Показать на карте: ${row.object_name}`}
                      onClick={() => onFocusObject(row)}
                    >
                      {row.object_name}
                    </button>
                  ) : (
                    <span className="block truncate px-1" title={row.object_name || undefined}>
                      {row.object_name || '—'}
                    </span>
                  )}
                </td>
                <td className="tabular-nums">{formatAnalysisKm(row.distance_km)}</td>
                <td className="tabular-nums">{formatAnalysisKm(row.limit_km)}</td>
                <td>
                  <StatusBadge status={row.status} />
                </td>
                <td className="text-right tabular-nums">{rowCostMln(row) ?? '—'}</td>
                <td>{renderActions(row)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function AnalysisEnvironmentTable({
  rows,
  compact = false,
  sections = 'all',
  onPickCandidate,
  onToggleConstruction,
  onFocusObject,
}: Props) {
  const { internal, externalLinear, external, pads } = groupAnalysisRows(rows);
  const showInternal = sections === 'all' || sections === 'internal';
  const showExternalLinear =
    sections === 'all' || sections === 'externalLinear' || sections === 'mapConnectivity';
  const showExternal =
    sections === 'all' || sections === 'external' || sections === 'mapConnectivity';
  const showPads = sections === 'all' || sections === 'pads';

  if (rows.length === 0) return null;
  if (sections === 'external' && external.length === 0) return null;
  if (sections === 'externalLinear' && externalLinear.length === 0) return null;
  if (sections === 'internal' && internal.length === 0) return null;
  if (sections === 'pads' && pads.length === 0) return null;

  const cellPad = compact ? 'py-1' : 'py-2';
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
          <div className="table-wrap">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Подтип</th>
                  <th>Расчётная длина</th>
                  <th>Статус</th>
                  <th className="text-right">млн ₽</th>
                </tr>
              </thead>
              <tbody>
                {internal.map((row) => (
                  <tr key={row.subtype} className={cellPad}>
                    <td className="font-medium">{subtypeDisplayLabel(row.subtype)}</td>
                    <td>
                      <div>{formatAnalysisKm(row.distance_km)}</div>
                      {internalFormulaLabel(row) && (
                        <div style={{ color: 'var(--text-muted)', fontSize: compact ? '10px' : '11px' }}>
                          {internalFormulaLabel(row)}
                        </div>
                      )}
                    </td>
                    <td>
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="text-right tabular-nums">{rowCostMln(row) ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {showExternalLinear && externalLinear.length > 0 && (
        <ExternalObjectsTable
          title="Внешние линейные объекты"
          rows={externalLinear}
          compact={compact}
          cellPad={cellPad}
          paramType="external_linear"
          onPickCandidate={onPickCandidate}
          onToggleConstruction={onToggleConstruction}
          onFocusObject={onFocusObject}
        />
      )}

      {showExternal && external.length > 0 && (
        <ExternalObjectsTable
          title="Внешние объекты"
          rows={external}
          compact={compact}
          cellPad={cellPad}
          paramType="external"
          onPickCandidate={onPickCandidate}
          onToggleConstruction={onToggleConstruction}
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
          <div className="table-wrap">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Подтип</th>
                  <th>Кол-во</th>
                  <th>Статус</th>
                  <th className="text-right">млн ₽</th>
                </tr>
              </thead>
              <tbody>
                {pads.map((row) => (
                  <tr key={row.subtype} className={cellPad}>
                    <td className="font-medium">{subtypeDisplayLabel(row.subtype)}</td>
                    <td>{row.pads_count ?? '—'}</td>
                    <td>
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="text-right tabular-nums">{rowCostMln(row) ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
          <span className={`badge ${overallStatusBadgeClass(overallStatus)}`}>
            {statusLabelRu(overallStatus)}
          </span>
        )}
      </div>
      {totalCostMln != null && (
        <span className="text-lg font-bold tabular-nums">{totalCostMln} млн ₽</span>
      )}
    </div>
  );
}
