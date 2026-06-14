import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { defaultMapMutationsApi, type InfraObject } from '../lib/api';
import { padEarthworkApi } from '../lib/api/padEarthworkApi';
import { wellTrajectoryApi, type WellTrajectoryLastResponse } from '../lib/api/wellTrajectoryApi';
import { isProjectJobCreateResponse, pollProjectJobUntilDone } from '../lib/pollProjectJob';
import { wellTrajectoryQueryKeys } from './useWellTrajectoryGeoJson';
import {
  clampNdsDeg,
  DEFAULT_PAD_NDS_DEG,
  envelopeFromObject,
  envelopeWrapForApi,
  padParamsFromObject,
  readDemStatusFromProperties,
  resolveGeneratorNdsDeg,
} from '../lib/infraPadEarthwork';
import { padWellFieldsFromForm, padWellFormStringsFromObject } from '../lib/infraPadWells';
import {
  buildPadClusteringSaveProperties,
  filterPadObjects,
  isPadLayoutDraftDirty,
  type PadClusteringPadDraft,
} from '../lib/padClusteringSave';
import {
  calcDraftEquals,
  calcDraftFromSources,
  DEFAULT_CALC_STEP_M,
  type PadClusteringCalcDraft,
} from '../lib/padClusteringCalcSettings';
import {
  parseSketchFromLast,
  parseWellsLocalFromLast,
  planFromFormFields,
  tryLayoutPreviewFromWellForm,
  type PlanShapeSketch,
  type PlanVertex,
} from '../lib/padEarthworkSketch';
import { bottomholesLinkedToPad } from '../lib/wellBottomholeProperties';
import { isPersistedLayoutStale, wellsLocalMatch } from '../lib/padClusteringLayoutSync';
import { resolvePadClusteringSceneTrajectoryDisplay } from '../lib/padClusteringSceneTrajectories';
import { maybeRegenerateTrajectoriesAfterLayoutChange } from '../lib/wellTrajectoryLayoutRegenerate';
import { useAppStore } from '../store';

const DEFAULT_STEP_M = DEFAULT_CALC_STEP_M;

function parsePositive(raw: string): number | null {
  const t = raw.trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseHeightRef(heightM: string, referenceElevationM: string) {
  const height = parsePositive(heightM);
  const refRaw = referenceElevationM.trim().replace(',', '.');
  const ref = refRaw === '' ? 0 : Number(refRaw);
  if (height == null || !Number.isFinite(ref)) return null;
  return { height_m: height, reference_elevation_m: ref };
}

export function draftFromPad(pad: InfraObject, wellsCount = 0): PadClusteringPadDraft {
  const p = padParamsFromObject(pad);
  const wells = padWellFormStringsFromObject(pad.properties);
  return {
    ...wells,
    lengthM: p.lengthM,
    widthM: p.widthM,
    heightM: p.heightM,
    rotationDeg: resolveGeneratorNdsDeg(p.rotationDeg, wellsCount > 0),
    referenceElevationM: p.referenceElevationM,
  };
}

export function usePadClusteringEditor(
  projectId: string | null | undefined,
  padId: string | null | undefined,
  infraObjects: InfraObject[],
) {
  const queryClient = useQueryClient();
  const pushToast = useAppStore((s) => s.pushToast);

  const pad = useMemo(
    () => infraObjects.find((o) => o.id === padId) ?? null,
    [infraObjects, padId],
  );

  const pads = useMemo(() => filterPadObjects(infraObjects), [infraObjects]);

  const linkedBottomholes = useMemo(
    () => (padId ? bottomholesLinkedToPad(infraObjects, padId) : []),
    [infraObjects, padId],
  );

  const { data: earthworkLast, isLoading: earthworkLoading } = useQuery({
    queryKey: ['padEarthworkLast', projectId, padId],
    queryFn: () => padEarthworkApi.getLast(projectId!, padId!),
    enabled: Boolean(projectId && padId),
  });

  const trajectoryQk = padId && projectId ? wellTrajectoryQueryKeys(projectId, padId) : null;

  const { data: trajectoryLast, isLoading: trajectoryLoading } = useQuery({
    queryKey: trajectoryQk?.last ?? ['wellTrajectoryLast', projectId, padId],
    queryFn: () => wellTrajectoryApi.getLast(projectId!, padId!),
    enabled: Boolean(projectId && padId),
  });

  const savedSketch = useMemo(
    () => parseSketchFromLast(earthworkLast?.sketch ?? null),
    [earthworkLast?.sketch],
  );

  const wellsLocal = useMemo(
    () =>
      parseWellsLocalFromLast(
        earthworkLast?.wells_local ??
          (pad?.properties as Record<string, unknown> | undefined)?.pad_wells_local_json,
      ),
    [earthworkLast?.wells_local, pad?.properties],
  );

  const envelope = useMemo(
    () => earthworkLast?.envelope ?? envelopeFromObject(pad?.properties),
    [earthworkLast?.envelope, pad?.properties],
  );

  const sketch: PlanShapeSketch = useMemo(() => {
    if (savedSketch) return savedSketch;
    if (!pad) return planFromFormFields('120', '80', '90');
    const d = draftFromPad(pad, wellsLocal.length);
    return planFromFormFields(d.lengthM, d.widthM, d.rotationDeg);
  }, [savedSketch, pad, wellsLocal.length]);

  const [draft, setDraft] = useState<PadClusteringPadDraft | null>(null);
  const [calcDraft, setCalcDraft] = useState<PadClusteringCalcDraft | null>(null);
  const [savedCalcDraft, setSavedCalcDraft] = useState<PadClusteringCalcDraft | null>(null);
  const [localWellsLocal, setLocalWellsLocal] = useState<PlanVertex[]>([]);
  const [localSketch, setLocalSketch] = useState<PlanShapeSketch | null>(null);
  const [sketchDirty, setSketchDirty] = useState(false);

  useEffect(() => {
    if (!pad) {
      setDraft(null);
      setCalcDraft(null);
      setSavedCalcDraft(null);
      setLocalWellsLocal([]);
      setLocalSketch(null);
      setSketchDirty(false);
      return;
    }
    setDraft(draftFromPad(pad, wellsLocal.length));
    const calc = calcDraftFromSources({
      properties: pad.properties as Record<string, unknown>,
      settings: trajectoryLast?.settings,
      envelope,
    });
    setCalcDraft(calc);
    setSavedCalcDraft(calc);
    setLocalWellsLocal(wellsLocal);
    setLocalSketch(null);
    setSketchDirty(false);
  }, [pad?.id, pad?.properties, wellsLocal, trajectoryLast?.settings, envelope]);

  const activeDraft = draft ?? (pad ? draftFromPad(pad, wellsLocal.length) : null);
  const activeCalcDraft =
    calcDraft ??
    calcDraftFromSources({
      properties: (pad?.properties as Record<string, unknown>) ?? null,
      settings: trajectoryLast?.settings,
      envelope,
    });

  const layoutPreview = useMemo(
    () => (activeDraft ? tryLayoutPreviewFromWellForm(activeDraft) : null),
    [activeDraft],
  );

  const savedPadDraft = useMemo(
    () => (pad ? draftFromPad(pad, wellsLocal.length) : null),
    [pad, wellsLocal.length],
  );

  const isLayoutDraftDirty = useMemo(() => {
    if (!activeDraft || !savedPadDraft) return false;
    return isPadLayoutDraftDirty(activeDraft, savedPadDraft);
  }, [activeDraft, savedPadDraft]);

  const layoutPreviewStale = useMemo(
    () =>
      !sketchDirty &&
      !isLayoutDraftDirty &&
      isPersistedLayoutStale(wellsLocal, savedSketch ?? null, layoutPreview),
    [sketchDirty, isLayoutDraftDirty, wellsLocal, savedSketch, layoutPreview],
  );

  const useLiveLayoutPreview = Boolean(
    layoutPreview && (isLayoutDraftDirty || sketchDirty || layoutPreviewStale),
  );

  const activeSketch = useLiveLayoutPreview
    ? layoutPreview!.sketch
    : localSketch ?? sketch;
  const activeWellsLocal = useLiveLayoutPreview
    ? layoutPreview!.wellsLocal
    : sketchDirty
      ? localWellsLocal
      : wellsLocal;

  const demAssetId = earthworkLast?.dem?.asset_id ?? null;
  const demAvailable = Boolean(demAssetId);

  const previewParams = useMemo(() => {
    if (!activeDraft) return null;
    return parseHeightRef(activeDraft.heightM, activeDraft.referenceElevationM);
  }, [activeDraft]);

  const previewSketchKey = useMemo(() => {
    if (!previewParams) return '';
    return JSON.stringify({ sketch: activeSketch, params: previewParams });
  }, [activeSketch, previewParams]);

  const { data: demPreview, isFetching: demPreviewLoading } = useQuery({
    queryKey: ['padDemPreview', projectId, padId, previewSketchKey, demAssetId],
    queryFn: () =>
      padEarthworkApi.fetchDemPreview(projectId!, padId!, {
        sketch: activeSketch,
        params: previewParams ?? undefined,
      }),
    enabled: Boolean(projectId && padId && demAvailable && previewParams && previewSketchKey),
    staleTime: 30_000,
    retry: false,
  });

  const invalidateAll = useCallback(() => {
    if (!projectId || !padId) return;
    void queryClient.invalidateQueries({ queryKey: ['padEarthworkLast', projectId, padId] });
    void queryClient.invalidateQueries({ queryKey: wellTrajectoryQueryKeys(projectId, padId).last });
    void queryClient.invalidateQueries({ queryKey: ['wellTrajectoryProjectGeoJson', projectId] });
    void queryClient.invalidateQueries({ queryKey: ['infra', projectId] });
  }, [projectId, padId, queryClient]);

  const patchTrajectoryLast = useCallback(
    (patch: Partial<WellTrajectoryLastResponse>) => {
      if (!trajectoryQk) return;
      queryClient.setQueryData<WellTrajectoryLastResponse>(trajectoryQk.last, (old) => {
        if (!old) return old;
        return { ...old, ...patch };
      });
    },
    [queryClient, trajectoryQk],
  );

  const patchCalcDraft = useCallback((patch: Partial<PadClusteringCalcDraft>) => {
    setCalcDraft((prev) => {
      const base =
        prev ??
        calcDraftFromSources({
          properties: (pad?.properties as Record<string, unknown>) ?? null,
          settings: trajectoryLast?.settings,
          envelope,
        });
      return { ...base, ...patch };
    });
  }, [pad?.properties, trajectoryLast?.settings, envelope]);

  const patchDraft = useCallback(
    (patch: Partial<PadClusteringPadDraft>) => {
      setDraft((prev) => {
        if (!pad) return prev;
        const base = prev ?? draftFromPad(pad, wellsLocal.length);
        return { ...base, ...patch };
      });
    },
    [pad, wellsLocal.length],
  );

  const buildGenerateBody = useCallback(() => {
    if (!activeDraft) return {};
    const fields = padWellFieldsFromForm(activeDraft);
    const rotRaw = activeDraft.rotationDeg.trim().replace(',', '.');
    const rotation = rotRaw === '' ? DEFAULT_PAD_NDS_DEG : Number(rotRaw);
    return {
      well_count: fields.wellCount,
      wells_per_group: fields.wellsPerGroup,
      well_spacing_m: fields.wellSpacingM,
      group_spacing_m: fields.groupSpacingM,
      margins: {
        left_m: fields.leftM,
        bottom_m: fields.bottomM,
        top_m: fields.topM,
        end_m: fields.endM,
      },
      rotation_deg: Number.isFinite(rotation) ? clampNdsDeg(rotation) : DEFAULT_PAD_NDS_DEG,
    };
  }, [activeDraft]);

  const activeEnvelope = useMemo(() => {
    const wrap = parsePositive(activeCalcDraft.envelopeWrapWidthM) ?? 0;
    return {
      enabled: activeCalcDraft.envelopeEnabled,
      wrap_width_m: wrap,
    };
  }, [activeCalcDraft.envelopeEnabled, activeCalcDraft.envelopeWrapWidthM]);

  const demSource =
    earthworkLast?.dem?.source ??
    readDemStatusFromProperties(pad?.properties as Record<string, unknown> | undefined)?.source ??
    null;

  const savePadMut = useMutation({
    mutationFn: async () => {
      if (!projectId || !pad || !activeDraft) throw new Error('Выберите куст');
      const properties = buildPadClusteringSaveProperties(
        pad.properties,
        activeDraft,
        activeCalcDraft,
      );
      if (!properties) throw new Error('Проверьте габариты площадки');
      return defaultMapMutationsApi.updateInfraObject(projectId, pad.id, { properties });
    },
    onSuccess: () => {
      setSavedCalcDraft(activeCalcDraft);
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
      const generated = await padEarthworkApi.generateSketch(projectId, padId, buildGenerateBody());
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
      const step = parsePositive(activeCalcDraft.stepM) ?? DEFAULT_STEP_M;
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

  const trajectories = trajectoryLast?.trajectories ?? [];
  const trajectoryWarnings = trajectoryLast?.warnings ?? [];
  const trajectorySettings = trajectoryLast?.settings ?? null;
  const trajectoryComputedAt = trajectoryLast?.computed_at ?? null;
  const clearancePairs = trajectoryLast?.clearance_pairs ?? [];
  const clearanceComputedAt = trajectoryLast?.clearance_computed_at ?? null;

  /** Saved trajectories match persisted or active well layout for 3D display. */
  const sceneTrajectoryDisplay = useMemo(
    () =>
      resolvePadClusteringSceneTrajectoryDisplay({
        trajectories,
        persistedWellsLocal: wellsLocal,
        activeWellsLocal,
      }),
    [trajectories, wellsLocal, activeWellsLocal],
  );
  const sceneTrajectories = sceneTrajectoryDisplay.sceneTrajectories;
  const sceneWellsLocal = sceneTrajectoryDisplay.sceneWellsLocal;
  const sceneTrajectoriesHidden = sceneTrajectoryDisplay.sceneTrajectoriesHidden;
  const sceneUsesPersistedWells =
    sceneTrajectories.length > 0 &&
    wellsLocalMatch(sceneWellsLocal, wellsLocal) &&
    !wellsLocalMatch(activeWellsLocal, wellsLocal);

  const sceneLayoutCallout = useMemo(() => {
    if (layoutPreviewStale && sceneUsesPersistedWells && sceneTrajectories.length > 0) {
      return `Траектории показаны для сохранённой раскладки (${wellsLocal.length} уст.). Параметры слева отличаются — сгенерируйте план и сохраните куст.`;
    }
    if (layoutPreviewStale) {
      return 'На холсте — предпросмотр раскладки по параметрам слева. Нажмите «Сгенерировать план», затем «Сохранить».';
    }
    if (sceneTrajectoriesHidden) {
      return 'Траектории скрыты: раскладка изменилась. Сгенерируйте план, сохраните куст и пересчитайте траектории.';
    }
    return null;
  }, [
    layoutPreviewStale,
    sceneUsesPersistedWells,
    sceneTrajectories.length,
    wellsLocal.length,
    sceneTrajectoriesHidden,
  ]);

  const referenceElevationM = Number(activeDraft?.referenceElevationM ?? 0);
  const heightM = Number(activeDraft?.heightM ?? 1);
  const kbM =
    (Number.isFinite(referenceElevationM) ? referenceElevationM : 0) +
    (Number.isFinite(heightM) ? heightM : 0);

  const isCalcDirty = useMemo(() => {
    if (!savedCalcDraft) return false;
    return !calcDraftEquals(activeCalcDraft, savedCalcDraft);
  }, [activeCalcDraft, savedCalcDraft]);

  const isDraftDirty = useMemo(() => {
    if (!pad || !activeDraft || !savedPadDraft) return false;
    return (Object.keys(savedPadDraft) as (keyof PadClusteringPadDraft)[]).some(
      (key) => activeDraft[key] !== savedPadDraft[key],
    );
  }, [pad, activeDraft, savedPadDraft]);

  const isAnyDirty = isDraftDirty || isCalcDirty;

  const isLoading = earthworkLoading || trajectoryLoading;

  return {
    pads,
    pad,
    activeDraft,
    activeCalcDraft,
    patchCalcDraft,
    activeEnvelope,
    demSource,
    patchDraft,
    activeSketch,
    activeWellsLocal,
    sceneWellsLocal,
    sceneTrajectories,
    sceneTrajectoriesHidden,
    sceneLayoutCallout,
    layoutPreviewStale,
    isLayoutDraftDirty,
    wellsLocalCount: activeWellsLocal.length,
    envelope,
    demPreview: demPreview ?? null,
    demAvailable,
    demPreviewLoading,
    referenceElevationM: Number.isFinite(referenceElevationM) ? referenceElevationM : 0,
    heightM: Number.isFinite(heightM) ? heightM : 1,
    kbM,
    isDraftDirty,
    isCalcDirty,
    isAnyDirty,
    isLoading,
    trajectoryComputedAt,
    trajectories,
    trajectoryWarnings,
    trajectorySettings,
    clearancePairs,
    clearanceComputedAt,
    linkedBottomholes,
    earthworkLoading,
    trajectoryLoading,
    savePadMut,
    generateAndSaveMut,
    generateFromLayoutMut,
    syncBottomholesMut,
    designFromBottomholesMut,
    runClearanceMut,
    saveBottomholeMut,
  };
}

export { filterPadObjects, buildPadClusteringSaveProperties };
