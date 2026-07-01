import { ProjectLink } from '../../components/ProjectLink';
import type { SandLogisticsResult } from '../../lib/api';
import {
  buildHaulLegRows,
  consumerSandLogisticsWarnings,
  findSandLogisticsConsumer,
  haulLegSummaryLabel,
} from '../../lib/sandLogisticsHaulLegs';
import { SandHaulLegTable } from './SandHaulLegTable';

type Props = {
  objectId: string;
  sandLogistics: SandLogisticsResult | null | undefined;
  asOf?: string;
  /** Строка в таблице параметров — свёрнутое summary + раскрытие */
  variant?: 'panel' | 'parameters-row';
};

export function SandHaulLegDetails({
  objectId,
  sandLogistics,
  asOf,
  variant = 'panel',
}: Props) {
  if (variant === 'panel') {
    return (
      <SandHaulLegTable
        compact
        objectId={objectId}
        sandLogistics={sandLogistics}
        asOf={asOf}
      />
    );
  }

  const consumer = findSandLogisticsConsumer(sandLogistics, objectId);
  const warnings = consumerSandLogisticsWarnings(sandLogistics, objectId);

  if (!sandLogistics) {
    return (
      <span className="parameters-haul-leg-hint text-xs text-[var(--text-muted)]">
        <ProjectLink to="/logistics/schematic" className="text-[var(--primary)] hover:underline">
          Расчёт
        </ProjectLink>
      </span>
    );
  }

  if (!consumer) {
    return (
      <span className="parameters-haul-leg-hint text-xs text-[var(--text-muted)]" title="Нет в результатах расчёта">
        —
      </span>
    );
  }

  if (!consumer.in_service) {
    return (
      <span className="parameters-haul-leg-hint text-xs text-amber-600" title="Не введён в эксплуатацию">
        не введён
      </span>
    );
  }

  const rows = buildHaulLegRows(consumer);
  const summary = haulLegSummaryLabel(rows);

  if (!summary) {
    const warn = warnings[0];
    return (
      <span
        className="parameters-haul-leg-hint text-xs text-[var(--text-muted)]"
        title={warn ?? 'Нет пути к карьеру или нулевой спрос'}
      >
        {warn ? '⚠' : '—'}
      </span>
    );
  }

  return (
    <details className="sand-haul-leg-details parameters-haul-leg-details">
      <summary className="sand-haul-leg-details__summary text-xs cursor-pointer select-none">
        {summary}
      </summary>
      <div className="sand-haul-leg-details__body mt-1">
        <SandHaulLegTable
          compact
          objectId={objectId}
          sandLogistics={sandLogistics}
          asOf={asOf ?? sandLogistics.as_of}
        />
      </div>
    </details>
  );
}
