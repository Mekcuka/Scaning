import { useMutation, useQueryClient } from '@tanstack/react-query';
import { defaultMapMutationsApi } from '../lib/api';
import { padEarthworkApi } from '../lib/api/padEarthworkApi';
import { wellTrajectoryApi, type WellTrajectoryLastResponse } from '../lib/api/wellTrajectoryApi';
import { isProjectJobCreateResponse, pollProjectJobUntilDone } from '../lib/pollProjectJob';
import { envelopeWrapForApi } from '../lib/infraPadEarthwork';
import { maybeRegenerateTrajectoriesAfterLayoutChange } from '../lib/wellTrajectoryLayoutRegenerate';
import type { InfraObject } from '../lib/api';
import type { PadClusteringCalcDraft, PadClusteringPadDraft } from '../lib/padClusteringSave';
import { buildPadClusteringSaveProperties } from '../lib/padClusteringSave';
import type { PadClusteringPyWellGeoDraft } from '../lib/padClusteringPyWellGeoSettings';
import type { PlanShapeSketch, PlanVertex } from '../lib/padEarthworkSketch';
import { useAppStore } from '../store';
import {
  buildGenerateBodyFromDraft,
  parseHeightRef,
  parsePositive,
} from './padClusteringEditorUtils';

import { DEFAULT_CALC_STEP_M } from '../lib/padClusteringCalcSettings';

export interface PadClusteringEditorMutationsInput {
  projectId: string | null | undefined;
  padId: string | null | undefined;
  pad: InfraObject | null;
  activeDraft: PadClusteringPadDraft | null;
  activeCalcDraft: PadClusteringCalcDraft;
  activeGeoDraft: PadClusteringPyWellGeoDraft;
  wellsLocal: PlanVertex[];
  invalidateAll: () => void;
  patchTrajectoryLast: (patch: Partial<WellTrajectoryLastResponse>) => void;
  setSavedCalcDraft: (draft: PadClusteringCalcDraft) => void;
  setSavedGeoDraft: (draft: PadClusteringPyWellGeoDraft) => void;
  setLocalSketch: (sketch: PlanShapeSketch) => void;
  setLocalWellsLocal: (wells: PlanVertex[]) => void;
  setSketchDirty: (dirty: boolean) => void;
  patchDraft: (patch: Partial<PadClusteringPadDraft>) => void;
}

export function usePadClusteringEditorMutations(input: PadClusteringEditorMutationsInput) {
  const {
    projectId,
    padId,
    pad,
    activeDraft,
    activeCalcDraft,
    activeGeoDraft,
    wellsLocal,
    invalidateAll,
    patchTrajectoryLast,
    setSavedCalcDraft,
    setSavedGeoDraft,
    setLocalSketch,
    setLocalWellsLocal,
    setSketchDirty,
    patchDraft,
  } = input;

  const pushToast = useAppStore((s) => s.pushToast);
  const queryClient = useQueryClient();

  const savePadMut = useMutation({
    mutationFn: async () => {
      if (!projectId || !pad || !activeDraft) throw new Error('Выберите куст');
      const properties = buildPadClusteringSaveProperties(
        pad.properties,
        activeDraft,
        activeCalcDraft,
        activeGeoDraft,
      );
      if (!properties) throw new Error('Проверьте габариты площадки');
      return defaultMapMutationsApi.updateInfraObject(projectId, pad.id, { properties });
    },
    onSuccess: () => {
      setSavedCalcDraft(activeCalcDraft);
      setSavedGeoDraft(activeGeoDraft);
      if (projectId && padId) {
        queryClient.setQueryData(['pywellgeoLast', projectId, padId], {
          settings: activeGeoDraft.settings,
          trees: activeGeoDraft.trees,
          computed_at: null,
          warnings: [],
        });
      }
      pushToast('success', 'Настройки куста сохранены');
      invalidateAll();
    },
    onError: (err: Error) => pushToast('error', err.message || 'Ошибка сохранения'),
  });

  const generateAndSaveMut = useMutation({
    mutationFn: async () => {
      if (!projectId || !padId || !activeDraft) throw new Error('Выберите куст');
      const heightRef = parseHeightRef(activeDraft.heightM, activeDraft.referenceElevationM);
      if (!heightRef) throw new Error('Укажите высоту и опорную отметку');
      const previousWells = wellsLocal.map((w) => ({ east_m: w.east_m, north_m: w.north_m }));
      const generated = await padEarthworkApi.generateSketch(
        projectId,
        padId,
        buildGenerateBodyFromDraft(activeDraft),
      );
      await padEarthworkApi.saveSketch(projectId, padId, {
        sketch: generated.sketch,
        params: heightRef,
        wells_local: generated.wells_local,
        rotation_deg: generated.rotation_deg,
        envelope: envelopeWrapForApi(
          activeCalcDraft.envelopeEnabled,
          parsePositive(activeCalcDraft.envelopeWrapWidthM) ?? 0,
        ),
      });
      return { generated, previousWells };
    },
    onSuccess: async ({ generated, previousWells }) => {
      setLocalSketch(generated.sketch);
      setLocalWellsLocal(generated.wells_local);
      setSketchDirty(true);
      patchDraft({
        lengthM: String(generated.length_m),
        widthM: String(generated.width_m),
        rotationDeg: String(generated.rotation_deg),
      });
      pushToast('success', `Контур сгенерирован: ${generated.wells_local.length} устьев`);
      const regenerated = await maybeRegenerateTrajectoriesAfterLayoutChange({
        projectId: projectId!,
        padId: padId!,
        previousWells,
        nextWells: generated.wells_local,
      });
      if (regenerated) {
        pushToast('info', 'Траектории пересчитаны из новой раскладки');
      }
      invalidateAll();
    },
    onError: (err: Error) => pushToast('error', err.message || 'Ошибка генерации'),
  });

  const generateFromLayoutMut = useMutation({
    mutationFn: () => wellTrajectoryApi.generateFromLayout(projectId!, padId!),
    onSuccess: (data) => {
      patchTrajectoryLast({
        trajectories: data.trajectories,
        computed_at: data.computed_at ?? new Date().toISOString(),
      });
      pushToast('success', 'Заготовки траекторий созданы из раскладки');
      invalidateAll();
    },
    onError: (err: Error) => pushToast('error', err.message || 'Ошибка генерации'),
  });

  const syncBottomholesMut = useMutation({
    mutationFn: () => wellTrajectoryApi.syncBottomholes(projectId!, padId!),
    onSuccess: (data) => {
      patchTrajectoryLast({
        trajectories: data.trajectories,
        warnings: data.warnings,
      });
      pushToast('success', 'Забои синхронизированы');
      invalidateAll();
    },
    onError: (err: Error) => pushToast('error', err.message || 'Ошибка синхронизации'),
  });

  const designFromBottomholesMut = useMutation({
    mutationFn: async () => {
      const step = parsePositive(activeCalcDraft.stepM) ?? DEFAULT_CALC_STEP_M;
      return wellTrajectoryApi.designFromBottomholes(projectId!, padId!, { step_m: step });
    },
    onSuccess: (data) => {
      patchTrajectoryLast({
        trajectories: data.trajectories,
        warnings: data.warnings,
        computed_at: new Date().toISOString(),
      });
      const n = data.designed?.length ?? 0;
      pushToast('success', n > 0 ? `Построено траекторий: ${n}` : 'Расчёт завершён');
      invalidateAll();
    },
    onError: (err: Error) => pushToast('error', err.message || 'Ошибка расчёта'),
  });

  const runClearanceMut = useMutation({
    mutationFn: () => wellTrajectoryApi.runPadClearance(projectId!, padId!),
    onSuccess: (data) => {
      if (isProjectJobCreateResponse(data)) {
        pushToast('info', 'Задача anti-collision в журнале задач');
        void pollProjectJobUntilDone(projectId!, data.job_id).then(() => {
          pushToast('success', 'Расчёт SF завершён');
          invalidateAll();
        });
        return;
      }
      pushToast('success', `SF: ${data.pairs_count} пар, ${data.wells_count} скважин`);
      invalidateAll();
    },
    onError: (err: Error) => pushToast('error', err.message || 'Ошибка расчёта SF'),
  });

  const saveBottomholeMut = useMutation({
    mutationFn: async ({
      objectId,
      properties,
    }: {
      objectId: string;
      properties: Record<string, unknown>;
    }) => {
      if (!projectId) throw new Error('Нет проекта');
      return defaultMapMutationsApi.updateInfraObject(projectId, objectId, { properties });
    },
    onSuccess: () => {
      pushToast('success', 'Забой сохранён');
      invalidateAll();
    },
    onError: (err: Error) => pushToast('error', err.message || 'Ошибка сохранения забоя'),
  });

  return {
    savePadMut,
    generateAndSaveMut,
    generateFromLayoutMut,
    syncBottomholesMut,
    designFromBottomholesMut,
    runClearanceMut,
    saveBottomholeMut,
  };
}
