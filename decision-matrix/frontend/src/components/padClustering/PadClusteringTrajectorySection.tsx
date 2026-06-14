import { Route } from 'lucide-react';
import { countDesignedTrajectories } from '../../lib/padClusteringWorkflow';
import type { ClearancePair, WellTrajectory } from '../../lib/api/wellTrajectoryApi';
import type { usePadClusteringEditor } from '../../hooks/usePadClusteringEditor';
import { PadClusteringCollapsibleSection } from './PadClusteringCollapsibleSection';
import { translateWellTrajectoryUserMessage } from '../../lib/wellTrajectoryUserMessages';

type Editor = ReturnType<typeof usePadClusteringEditor>;

interface PadClusteringTrajectorySectionProps {
  readOnly: boolean;
  trajectories: Editor['trajectories'];
  warnings: string[];
  linkedBottomholesCount: number;
  wellsLocalCount: number;
  clearancePairs: ClearancePair[];
  clearanceComputedAt: string | null;
  sfThreshold: number;
  generateFromLayoutMut: Editor['generateFromLayoutMut'];
  syncBottomholesMut: Editor['syncBottomholesMut'];
  designFromBottomholesMut: Editor['designFromBottomholesMut'];
  runClearanceMut: Editor['runClearanceMut'];
  selectedWellIndex: number | null;
  onSelectWell: (wellIndex: number | null) => void;
}

function wellLabel(well: { well_index: number; name?: string }): string {
  return well.name ?? `Скв-${well.well_index + 1}`;
}

function pairWellLabel(pair: ClearancePair, side: 'a' | 'b', currentPadId?: string): string {
  const idx = side === 'a' ? pair.well_a : pair.well_b;
  const padName = side === 'a' ? pair.well_a_pad_name : pair.well_b_pad_name;
  const padId = side === 'a' ? pair.well_a_pad_id : pair.well_b_pad_id;
  const base = `Скв-${idx + 1}`;
  if (padId && currentPadId && padId !== currentPadId && padName) {
    return `${base} (${padName})`;
  }
  return base;
}

export function PadClusteringTrajectorySection({
  readOnly,
  trajectories,
  warnings,
  linkedBottomholesCount,
  wellsLocalCount,
  clearancePairs,
  clearanceComputedAt,
  sfThreshold,
  generateFromLayoutMut,
  syncBottomholesMut,
  designFromBottomholesMut,
  runClearanceMut,
  selectedWellIndex,
  onSelectWell,
}: PadClusteringTrajectorySectionProps) {
  const toggleWell = (index: number) => {
    onSelectWell(selectedWellIndex === index ? null : index);
  };
  const pending =
    generateFromLayoutMut.isPending ||
    syncBottomholesMut.isPending ||
    designFromBottomholesMut.isPending ||
    runClearanceMut.isPending;

  const error =
    generateFromLayoutMut.error ??
    syncBottomholesMut.error ??
    designFromBottomholesMut.error ??
    runClearanceMut.error;

  const designedCount = countDesignedTrajectories(trajectories);
  const designedForClearance = trajectories.filter(
    (w) => (w.survey?.stations?.length ?? 0) >= 2,
  ).length;
  const clearanceReady = designedForClearance >= 2;

  return (
    <PadClusteringCollapsibleSection
      id="pad-clustering-section-trajectory"
      title="Траектория"
      icon={<Route size={15} strokeWidth={2} aria-hidden />}
      badge={
        <span
          className={`pad-clustering-badge ${
            designedCount > 0 ? 'pad-clustering-badge--ok' : 'pad-clustering-badge--warn'
          }`}
        >
          {designedCount > 0 ? `${designedCount} постр.` : 'не рассчитано'}
        </span>
      }
      hint="Заготовки из раскладки → забои на карте → расчёт профиля → антиколлизия (SF)."
      defaultOpen
    >
      <ol className="pad-clustering-steps">
        <li className={wellsLocalCount > 0 ? 'pad-clustering-steps__item--done' : ''}>
          <span className="pad-clustering-steps__num">1</span>
          <div>
            <strong>Схема устьев</strong>
            <p>{wellsLocalCount > 0 ? `${wellsLocalCount} устьев на площадке` : 'Сгенерируйте контур слева'}</p>
          </div>
          <button
            type="button"
            className="btn btn--secondary btn--sm pad-clustering-steps__action"
            disabled={readOnly || pending || wellsLocalCount === 0}
            onClick={() => generateFromLayoutMut.mutate()}
          >
            {generateFromLayoutMut.isPending ? '…' : 'Заготовки'}
          </button>
        </li>
        <li className={linkedBottomholesCount > 0 ? 'pad-clustering-steps__item--done' : ''}>
          <span className="pad-clustering-steps__num">2</span>
          <div>
            <strong>Забои</strong>
            <p>
              {linkedBottomholesCount > 0
                ? `${linkedBottomholesCount} на карте`
                : 'Добавьте инструментом «Забой»'}
            </p>
          </div>
          <button
            type="button"
            className="btn btn--secondary btn--sm pad-clustering-steps__action"
            disabled={readOnly || pending}
            onClick={() => syncBottomholesMut.mutate()}
          >
            {syncBottomholesMut.isPending ? '…' : 'Синхр.'}
          </button>
        </li>
        <li className={designedCount > 0 ? 'pad-clustering-steps__item--done' : ''}>
          <span className="pad-clustering-steps__num">3</span>
          <div>
            <strong>Расчёт до забоя</strong>
            <p className="pad-clustering-steps__hint">
              Шаг инклинометрии и модель погрешностей — вкладка «Расчёт».
            </p>
          </div>
          <button
            type="button"
            className="btn btn--primary btn--sm pad-clustering-steps__action"
            disabled={
              readOnly ||
              pending ||
              (trajectories.length === 0 && linkedBottomholesCount === 0)
            }
            onClick={() => designFromBottomholesMut.mutate()}
          >
            {designFromBottomholesMut.isPending ? '…' : 'Рассчитать'}
          </button>
        </li>
        <li className={clearancePairs.length > 0 ? 'pad-clustering-steps__item--done' : ''}>
          <span className="pad-clustering-steps__num">4</span>
          <div>
            <strong>Антиколлизия (SF)</strong>
            <p className="pad-clustering-steps__hint">
              {clearanceReady
                ? `Порог SF: ${sfThreshold}`
                : 'Нужны ≥2 спроектированных скважины на кусте'}
            </p>
          </div>
          <button
            type="button"
            className="btn btn--secondary btn--sm pad-clustering-steps__action"
            disabled={readOnly || pending || !clearanceReady}
            onClick={() => runClearanceMut.mutate()}
          >
            {runClearanceMut.isPending ? '…' : 'Рассчитать SF'}
          </button>
        </li>
      </ol>

      {warnings.length > 0 && (
        <ul className="pad-clustering-warnings">
          {warnings.map((w) => (
            <li key={w}>{translateWellTrajectoryUserMessage(w)}</li>
          ))}
        </ul>
      )}

      {error && (
        <p className="pad-clustering-section__error">
          {translateWellTrajectoryUserMessage(
            error instanceof Error ? error.message : 'Ошибка операции',
          )}
        </p>
      )}

      {trajectories.length === 0 && wellsLocalCount > 0 && (
        <ul className="pad-clustering-well-list" aria-label="Скважины на площадке">
          {Array.from({ length: wellsLocalCount }, (_, index) => (
            <li key={index}>
              <button
                type="button"
                className={`pad-clustering-well-list__item${
                  selectedWellIndex === index ? ' pad-clustering-well-list__item--selected' : ''
                }`}
                onClick={() => toggleWell(index)}
              >
                <span className="pad-clustering-well-list__name">Скв-{index + 1}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {trajectories.length > 0 && (
        <ul className="pad-clustering-well-list" aria-label="Скважины">
          {trajectories.map((well) => {
            const hasTarget = Boolean(well.target?.tvd_m);
            const stationCount = well.survey?.stations?.length ?? 0;
            const designed = stationCount >= 2;
            const minSf = well.clearance?.min_sf;
            const selected = selectedWellIndex === well.well_index;
            return (
              <li key={well.well_index}>
                <button
                  type="button"
                  className={`pad-clustering-well-list__item${
                    selected ? ' pad-clustering-well-list__item--selected' : ''
                  }`}
                  onClick={() => toggleWell(well.well_index)}
                >
                <span className="pad-clustering-well-list__name">{wellLabel(well)}</span>
                <span
                  className={`pad-clustering-well-list__pill${
                    hasTarget ? ' pad-clustering-well-list__pill--ok' : ''
                  }`}
                >
                  {hasTarget ? 'забой' : 'нет забоя'}
                </span>
                {designed && (
                  <span className="pad-clustering-well-list__pill pad-clustering-well-list__pill--ok">
                    {stationCount} ст.
                  </span>
                )}
                {minSf != null && (
                  <span
                    className={`pad-clustering-well-list__pill${
                      minSf < sfThreshold ? '' : ' pad-clustering-well-list__pill--ok'
                    }`}
                  >
                    SF {minSf.toFixed(2)}
                  </span>
                )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {clearancePairs.length > 0 && (
        <div className="pad-clustering-subsection">
          <strong className="text-xs">Пары SF ({clearancePairs.length})</strong>
          <table className="pad-clustering-table text-xs">
            <thead>
              <tr>
                <th>Скв. A</th>
                <th>Скв. B</th>
                <th>мин. SF</th>
              </tr>
            </thead>
            <tbody>
              {clearancePairs.map((pair, i) => (
                <tr key={`${pair.well_a}-${pair.well_b}-${i}`}>
                  <td>{pairWellLabel(pair, 'a')}</td>
                  <td>{pairWellLabel(pair, 'b')}</td>
                  <td>
                    <span className={pair.warning ? 'pad-clustering-sf-warn' : 'pad-clustering-sf-ok'}>
                      {pair.min_sf.toFixed(2)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {clearanceComputedAt && (
            <p className="pad-clustering-steps__hint">
              Антиколлизия (SF): {new Date(clearanceComputedAt).toLocaleString()}
            </p>
          )}
        </div>
      )}
    </PadClusteringCollapsibleSection>
  );
}
