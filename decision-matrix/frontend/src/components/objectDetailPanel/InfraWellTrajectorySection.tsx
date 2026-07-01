import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GitBranch } from 'lucide-react';
import { Button } from 'antd';

import {
  wellTrajectoryApi,
  type ClearancePair,
  type WellTrajectory,
} from '../../lib/api/wellTrajectoryApi';
import { readWellTrajectoryStepM } from '../../lib/padClusteringCalcSettings';
import { wellTrajectoryQueryKeys } from '../../hooks/useWellTrajectoryGeoJson';
import { isProjectJobCreateResponse, pollProjectJobUntilDone } from '../../lib/pollProjectJob';
import { parseWellsLocalFromLast } from '../../lib/padEarthworkSketch';
import { countDesignedTrajectories } from '../../lib/padClusteringWorkflow';
import { formatMinSf } from '../../lib/wellTrajectoryClearance';
import { readPadWellParams } from '../../lib/infraPadWells';

import type { InfraObject } from '../../lib/api';
import { SUBTYPE_LABELS } from '../../lib/api';

import {
  bottomholesLinkedToPad,
  logicalWellCountFromBottomholes,
} from '../../lib/wellBottomholeProperties';

import { PanelSection, PanelSubsection, StatChip } from './panelUi';
import { AppDataTable } from '../AppDataTable';
import type { ColumnsType } from 'antd/es/table';
import { translateWellTrajectoryUserMessage } from '../../lib/wellTrajectoryUserMessages';

interface InfraWellTrajectorySectionProps {
  projectId: string;
  infraObject: InfraObject;
  infraObjects: InfraObject[];
  readOnly: boolean;
}

function wellLabel(well: WellTrajectory): string {
  return well.name ?? `Скв-${well.well_index + 1}`;
}

function bottomholeLabel(obj: InfraObject): string {
  return SUBTYPE_LABELS[obj.subtype] ?? obj.name;
}

function pairWellLabel(
  pair: { well_a: number; well_b: number; well_b_pad_name?: string; well_b_pad_id?: string },
  side: 'a' | 'b',
  currentPadId: string,
): string {
  const idx = side === 'a' ? pair.well_a : pair.well_b;
  const padName = side === 'b' ? pair.well_b_pad_name : undefined;
  const padId = side === 'b' ? pair.well_b_pad_id : undefined;
  const base = `Скв-${idx + 1}`;
  if (padId && padId !== currentPadId && padName) {
    return `${base} (${padName})`;
  }
  return base;
}

export function InfraWellTrajectorySection({
  projectId,
  infraObject,
  infraObjects,
  readOnly,
}: InfraWellTrajectorySectionProps) {
  const queryClient = useQueryClient();
  const qk = wellTrajectoryQueryKeys(projectId, infraObject.id);

  const { data: last, isLoading } = useQuery({
    queryKey: qk.last,
    queryFn: () => wellTrajectoryApi.getLast(projectId, infraObject.id),
    enabled: Boolean(projectId && infraObject.id),
  });

  const linkedBottomholes = useMemo(
    () => bottomholesLinkedToPad(infraObjects, infraObject.id),
    [infraObjects, infraObject.id],
  );
  const logicalBottomholeWells = useMemo(
    () => logicalWellCountFromBottomholes(linkedBottomholes),
    [linkedBottomholes],
  );

  const wellsLocalCount = useMemo(() => {
    if (last?.wells_local?.length) return last.wells_local.length;
    const raw = (infraObject.properties as Record<string, unknown> | undefined)?.pad_wells_local_json;
    const parsed = parseWellsLocalFromLast(raw).length;
    if (parsed > 0) return parsed;
    return readPadWellParams(infraObject.properties).wellCount;
  }, [last?.wells_local, infraObject.properties]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: qk.last });
    void queryClient.invalidateQueries({ queryKey: ['wellTrajectoryProjectGeoJson', projectId] });
  };

  const generateMut = useMutation({
    mutationFn: () => wellTrajectoryApi.generateFromLayout(projectId, infraObject.id),
    onSuccess: invalidate,
  });

  const stepM = readWellTrajectoryStepM({
    properties: infraObject.properties as Record<string, unknown> | undefined,
    settings: last?.settings,
  });

  const designFromBottomholesMut = useMutation({
    mutationFn: () =>
      wellTrajectoryApi.designFromBottomholes(projectId, infraObject.id, { step_m: stepM }),
    onSuccess: invalidate,
  });

  const runClearanceMut = useMutation({
    mutationFn: () => wellTrajectoryApi.runPadClearance(projectId, infraObject.id),
    onSuccess: (data) => {
      if (isProjectJobCreateResponse(data)) {
        void pollProjectJobUntilDone(projectId, data.job_id).then(invalidate);
        return;
      }
      invalidate();
    },
  });

  const trajectories = last?.trajectories ?? [];
  const warnings = last?.warnings ?? [];
  const clearancePairs = last?.clearance_pairs ?? [];
  const sfThreshold = last?.settings?.sf_warning_threshold ?? 1;
  const designedCount = countDesignedTrajectories(trajectories);
  const designedForClearance = trajectories.filter(
    (w) => (w.survey?.stations?.length ?? 0) >= 2,
  ).length;
  const clearanceReady = designedForClearance >= 2;

  const pending =
    generateMut.isPending ||
    designFromBottomholesMut.isPending ||
    runClearanceMut.isPending;

  const mutationError =
    generateMut.error ?? designFromBottomholesMut.error ?? runClearanceMut.error;

  const layoutReady = wellsLocalCount > 0 || trajectories.length > 0;
  const bottomholesReady = logicalBottomholeWells > 0;
  const designReady = designedCount > 0;
  const clearanceDone = clearancePairs.length > 0;

  const clearanceColumns = useMemo<ColumnsType<ClearancePair>>(
    () => [
      {
        title: 'Скв. A',
        key: 'well_a',
        render: (_, pair) => pairWellLabel(pair, 'a', infraObject.id),
      },
      {
        title: 'Скв. B',
        key: 'well_b',
        render: (_, pair) => pairWellLabel(pair, 'b', infraObject.id),
      },
      {
        title: 'мин. SF',
        key: 'min_sf',
        render: (_, pair) => (
          <span
            className={
              pair.min_sf != null && Number.isFinite(pair.min_sf)
                ? pair.warning
                  ? 'odp-traj-sf odp-traj-sf--warn'
                  : 'odp-traj-sf odp-traj-sf--ok'
                : 'object-detail-panel__meta'
            }
          >
            {formatMinSf(pair.min_sf)}
          </span>
        ),
      },
    ],
    [infraObject.id],
  );

  return (
    <PanelSection title="Траектории скважин" card>
      <div className="odp-traj-head">
        <div className="odp-traj-head__icon" aria-hidden>
          <GitBranch size={16} strokeWidth={2} />
        </div>
        <div className="odp-traj-head__stats">
          <StatChip>{wellsLocalCount} устьев</StatChip>
          <StatChip>
            {bottomholesReady ? `${logicalBottomholeWells} заб.` : 'нет забоев'}
          </StatChip>
          <StatChip>
            {designReady ? `${designedCount} постр.` : 'не рассчитано'}
          </StatChip>
        </div>
      </div>

      <p className="object-detail-panel__hint object-detail-panel__hint--intro">
        Раскладка устьев → забои на карте → расчёт профиля → антиколлизия (SF).
      </p>

      <ol className="odp-traj-steps" aria-label="Этапы расчёта траекторий">
        <li className={layoutReady ? 'odp-traj-steps__item--done' : ''}>
          <span className="odp-traj-steps__num">1</span>
          <div>
            <strong>Раскладка устьев</strong>
            <p>
              {layoutReady
                ? `${wellsLocalCount} устьев на площадке`
                : 'Вкладка «Логистика» → «Земляные работы» или число скв. на кусте'}
            </p>
          </div>
          <Button
            size="small"
            className="odp-traj-steps__action"
            disabled={readOnly || pending}
            loading={generateMut.isPending}
            onClick={() => generateMut.mutate()}
          >
            {generateMut.isPending ? '…' : 'Заготовки'}
          </Button>
        </li>

        <li className={bottomholesReady ? 'odp-traj-steps__item--done' : ''}>
          <span className="odp-traj-steps__num">2</span>
          <div>
            <strong>Забои на карте</strong>
            <p>
              {bottomholesReady
                ? `${logicalBottomholeWells} скв. · ${linkedBottomholes.length} объект(ов)`
                : 'Инструмент «Забой» на панели рисования карты'}
            </p>
          </div>
        </li>

        <li className={designReady ? 'odp-traj-steps__item--done' : ''}>
          <span className="odp-traj-steps__num">3</span>
          <div>
            <strong>Расчёт до забоя</strong>
            <p className="odp-traj-steps__hint">
              {bottomholesReady
                ? `Шаг инклинометрии: ${stepM} м`
                : 'Сначала разместите забои на карте'}
            </p>
          </div>
          <Button
            type="primary"
            size="small"
            className="odp-traj-steps__action"
            disabled={
              readOnly ||
              pending ||
              (trajectories.length === 0 && linkedBottomholes.length === 0)
            }
            loading={designFromBottomholesMut.isPending}
            onClick={() => designFromBottomholesMut.mutate()}
          >
            {designFromBottomholesMut.isPending ? '…' : 'Рассчитать'}
          </Button>
        </li>

        <li className={clearanceDone ? 'odp-traj-steps__item--done' : ''}>
          <span className="odp-traj-steps__num">4</span>
          <div>
            <strong>Антиколлизия (SF)</strong>
            <p className="odp-traj-steps__hint">
              {clearanceReady
                ? `Порог SF: ${sfThreshold}`
                : 'Нужны ≥2 скважины с рассчитанной траекторией'}
            </p>
          </div>
          <Button
            size="small"
            className="odp-traj-steps__action"
            disabled={readOnly || pending || !clearanceReady}
            loading={runClearanceMut.isPending}
            onClick={() => runClearanceMut.mutate()}
          >
            {runClearanceMut.isPending ? '…' : 'SF'}
          </Button>
        </li>
      </ol>

      {warnings.length > 0 && (
        <ul className="odp-traj-warnings">
          {warnings.map((w) => (
            <li key={w}>{translateWellTrajectoryUserMessage(w)}</li>
          ))}
        </ul>
      )}

      {mutationError && (
        <p className="odp-traj-error">
          {translateWellTrajectoryUserMessage(
            mutationError instanceof Error ? mutationError.message : 'Ошибка операции',
          )}
        </p>
      )}

      {isLoading && (
        <p className="object-detail-panel__hint">Загрузка сохранённых траекторий…</p>
      )}

      {bottomholesReady && (
        <PanelSubsection title={`Забои (${linkedBottomholes.length})`}>
          <ul className="odp-traj-chip-list">
            {linkedBottomholes.map((bh) => (
              <li key={bh.id}>
                <span className="odp-traj-chip">
                  <span className="odp-traj-chip__label">{bottomholeLabel(bh)}</span>
                  <span className="odp-traj-chip__meta">{bh.name}</span>
                </span>
              </li>
            ))}
          </ul>
        </PanelSubsection>
      )}

      {trajectories.length > 0 && (
        <PanelSubsection title={`Скважины (${trajectories.length})`}>
          <ul className="odp-traj-well-list" aria-label="Скважины куста">
            {trajectories.map((well) => {
              const hasTarget = Boolean(well.target?.tvd_m);
              const stationCount = well.survey?.stations?.length ?? 0;
              const designed = stationCount >= 2;
              const minSf = well.clearance?.min_sf;
              return (
                <li key={well.well_index}>
                  <div className="odp-traj-well-list__item">
                    <span className="odp-traj-well-list__name">{wellLabel(well)}</span>
                    <span
                      className={`odp-traj-well-list__pill${
                        hasTarget ? ' odp-traj-well-list__pill--ok' : ''
                      }`}
                    >
                      {hasTarget ? 'забой' : 'нет забоя'}
                    </span>
                    {designed && (
                      <span className="odp-traj-well-list__pill odp-traj-well-list__pill--ok">
                        {stationCount} ст.
                      </span>
                    )}
                    {minSf != null && (
                      <span
                        className={`odp-traj-well-list__pill${
                          minSf < sfThreshold ? ' odp-traj-well-list__pill--warn' : ' odp-traj-well-list__pill--ok'
                        }`}
                      >
                        SF {minSf.toFixed(2)}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </PanelSubsection>
      )}

      {clearancePairs.length > 0 && (
        <PanelSubsection title={`Пары SF (${clearancePairs.length})`}>
          <div className="odp-traj-table-wrap">
          <AppDataTable
            className="odp-traj-table"
            rowKey={(pair, index) => `${pair.well_a}-${pair.well_b}-${index}`}
            columns={clearanceColumns}
            dataSource={clearancePairs}
          />
          </div>
        </PanelSubsection>
      )}

      {(last?.computed_at || last?.clearance_computed_at) && (
        <p className="object-detail-panel__meta">
          {last?.computed_at && (
            <span>Профиль: {new Date(last.computed_at).toLocaleString()}</span>
          )}
          {last?.computed_at && last?.clearance_computed_at && ' · '}
          {last?.clearance_computed_at && (
            <span>SF: {new Date(last.clearance_computed_at).toLocaleString()}</span>
          )}
        </p>
      )}
    </PanelSection>
  );
}
