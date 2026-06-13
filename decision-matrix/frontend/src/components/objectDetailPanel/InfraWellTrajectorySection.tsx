import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  wellTrajectoryApi,
  type WellTrajectory,
} from '../../lib/api/wellTrajectoryApi';
import { readWellTrajectoryStepM } from '../../lib/padClusteringCalcSettings';
import { wellTrajectoryQueryKeys } from '../../hooks/useWellTrajectoryGeoJson';
import { isProjectJobCreateResponse, pollProjectJobUntilDone } from '../../lib/pollProjectJob';

import type { InfraObject } from '../../lib/api';

import { SUBTYPE_LABELS } from '../../lib/api';

import {
  WELL_BOTTOMHOLE_WELL_INDEX,
  isBottomholeSubtype,
  readBottomholeLinkedPadId,
} from '../../lib/wellBottomholeProperties';

import { FieldLabel, PanelSection } from './panelUi';

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

  const linkedBottomholes = infraObjects.filter(
    (obj) =>
      isBottomholeSubtype(obj.subtype) &&
      readBottomholeLinkedPadId(obj.properties) === infraObject.id,
  );

  const bottomholesByWell = new Map<number, InfraObject[]>();
  for (const bh of linkedBottomholes) {
    const raw = bh.properties?.[WELL_BOTTOMHOLE_WELL_INDEX];
    const idx =
      raw === '' || raw == null || Number.isNaN(Number(raw)) ? -1 : Number(raw);
    const key = idx >= 0 ? idx : linkedBottomholes.indexOf(bh);
    const list = bottomholesByWell.get(key) ?? [];
    list.push(bh);
    bottomholesByWell.set(key, list);
  }

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
  const designedForClearance = trajectories.filter(
    (w) => (w.survey?.stations?.length ?? 0) >= 2,
  ).length;
  const clearanceReady = designedForClearance >= 2;

  return (
    <PanelSection title="Траектории скважин">
      <p className="object-detail-panel__hint text-xs">
        Сначала разместите забои на карте (инструмент «Забой»). Раскладку устьев можно задать
        в «Земляные работы» или оставить число скважин на кусте — она создастся автоматически.
        Затем «Рассчитать до забоев» построит профиль траектории.
      </p>

      {warnings.length > 0 && (
        <ul className="object-detail-panel__hint text-xs text-amber-600">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}

      <div className="object-detail-panel__actions-row">
        <button
          type="button"
          className="btn btn--secondary btn--sm"
          disabled={readOnly || generateMut.isPending}
          onClick={() => generateMut.mutate()}
        >
          {generateMut.isPending ? 'Генерация…' : 'Из схемы куста'}
        </button>
        <button
          type="button"
          className="btn btn--secondary btn--sm"
          disabled={
            readOnly ||
            designFromBottomholesMut.isPending ||
            (trajectories.length === 0 && linkedBottomholes.length === 0)
          }
          onClick={() => designFromBottomholesMut.mutate()}
        >
          {designFromBottomholesMut.isPending ? 'Расчёт…' : 'Рассчитать до забоев'}
        </button>
        <button
          type="button"
          className="btn btn--secondary btn--sm"
          disabled={readOnly || runClearanceMut.isPending || !clearanceReady}
          title={
            clearanceReady
              ? undefined
              : 'Нужны минимум 2 скважины с survey ≥ 2 станций'
          }
          onClick={() => runClearanceMut.mutate()}
        >
          {runClearanceMut.isPending ? 'SF…' : 'Рассчитать SF'}
        </button>
      </div>

      {(generateMut.error || designFromBottomholesMut.error || runClearanceMut.error) && (
        <p className="object-detail-panel__hint text-xs text-red-600">
          {(generateMut.error ?? designFromBottomholesMut.error ?? runClearanceMut.error) instanceof
          Error
            ? (generateMut.error ?? designFromBottomholesMut.error ?? runClearanceMut.error)?.message
            : 'Ошибка операции'}
        </p>
      )}

      {linkedBottomholes.length === 0 && (
        <p className="object-detail-panel__hint text-xs">
          Нет привязанных объектов-забоев. Используйте «Забой» на панели рисования карты.
        </p>
      )}

      {linkedBottomholes.length > 0 && (
        <div className="object-detail-panel__subsection">
          <FieldLabel>Объекты-забои ({linkedBottomholes.length})</FieldLabel>
          <ul className="object-detail-panel__list text-xs">
            {linkedBottomholes.map((bh) => (
              <li key={bh.id} className="object-detail-panel__list-item">
                {bottomholeLabel(bh)} — {bh.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {isLoading && <p className="object-detail-panel__hint text-xs">Загрузка…</p>}

      {trajectories.length > 0 && (
        <div className="object-detail-panel__subsection">
          <FieldLabel>Скважины ({trajectories.length})</FieldLabel>
          <ul className="object-detail-panel__list text-xs">
            {trajectories.map((well) => {
              const hasTarget = Boolean(well.target?.tvd_m);
              const stationCount = well.survey?.stations?.length ?? 0;
              const linked = bottomholesByWell.get(well.well_index) ?? [];
              const minSf = well.clearance?.min_sf;
              return (
                <li key={well.well_index} className="object-detail-panel__list-item">
                  <span>
                    {wellLabel(well)}
                    {hasTarget ? ' · забой задан' : ' · забой не задан'}
                    {linked.length > 0
                      ? ` · ${linked.map((o) => bottomholeLabel(o)).join(', ')}`
                      : ' · нет объекта на карте'}
                    {stationCount > 1 ? ` · ${stationCount} ст.` : ''}
                    {minSf != null && (
                      <span className={minSf < sfThreshold ? ' text-amber-600' : ' text-green-700'}>
                        {` · SF ${minSf.toFixed(2)}`}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {clearancePairs.length > 0 && (
        <div className="object-detail-panel__subsection">
          <FieldLabel>Пары SF ({clearancePairs.length})</FieldLabel>
          <table className="object-detail-panel__table text-xs">
            <thead>
              <tr>
                <th>Скв. A</th>
                <th>Скв. B</th>
                <th>min SF</th>
              </tr>
            </thead>
            <tbody>
              {clearancePairs.map((pair, i) => (
                <tr key={`${pair.well_a}-${pair.well_b}-${i}`}>
                  <td>{pairWellLabel(pair, 'a', infraObject.id)}</td>
                  <td>{pairWellLabel(pair, 'b', infraObject.id)}</td>
                  <td className={pair.warning ? 'text-amber-600' : undefined}>
                    {pair.min_sf.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {last?.clearance_computed_at && (
        <p className="object-detail-panel__hint text-xs">
          SF: {new Date(last.clearance_computed_at).toLocaleString()}
        </p>
      )}

      {last?.computed_at && (
        <p className="object-detail-panel__hint text-xs">
          Последний пересчёт: {new Date(last.computed_at).toLocaleString()}
        </p>
      )}
    </PanelSection>
  );
}
