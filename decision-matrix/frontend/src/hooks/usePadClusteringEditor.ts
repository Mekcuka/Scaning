import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { InfraObject } from '../lib/api';
import { padEarthworkApi } from '../lib/api/padEarthworkApi';
import { wellTrajectoryApi, type WellTrajectoryLastResponse } from '../lib/api/wellTrajectoryApi';
import { pywellgeoApi } from '../lib/api/pywellgeoApi';
import {
  envelopeFromObject,
  readDemStatusFromProperties,
} from '../lib/infraPadEarthwork';
import {
  buildPadClusteringSaveProperties,
  filterPadObjects,
  isPadLayoutDraftDirty,
} from '../lib/padClusteringSave';
import {
  calcDraftEquals,
  calcDraftFromSources,
  type PadClusteringCalcDraft,
  type PadClusteringPadDraft,
} from '../lib/padClusteringCalcSettings';
import {
  pyWellGeoDraftEquals,
  pyWellGeoDraftFromSources,
  countTreeNodes,
  type PadClusteringPyWellGeoDraft,
} from '../lib/padClusteringPyWellGeoSettings';
import {
  parseSketchFromLast,
  parseWellsLocalFromLast,
  planFromFormFields,
  tryLayoutPreviewFromWellForm,
  type PlanShapeSketch,
  type PlanVertex,
} from '../lib/padEarthworkSketch';
import { bottomholesLinkedToPad } from '../lib/wellBottomholeProperties';
import { isPersistedLayoutStale } from '../lib/padClusteringLayoutSync';
import { wellTrajectoryQueryKeys } from './useWellTrajectoryGeoJson';
import {
  draftFromPad,
  draftFromPadSources,
  padClusteringDraftSourceKey,
  padClusteringDraftsEqual,
  parseHeightRef,
  parsePositive,
  resolvePadClusteringDraftSync,
} from './padClusteringEditorUtils';
import { usePadClusteringEditorMutations } from './usePadClusteringEditorMutations';
import {
  isPadFormDraftDirty,
  resolveActiveLayout,
  usePadClusteringEditorScene,
} from './usePadClusteringEditorScene';

export { draftFromPad } from './padClusteringEditorUtils';
export { filterPadObjects, buildPadClusteringSaveProperties };

export function usePadClusteringEditor(
  projectId: string | null | undefined,
  padId: string | null | undefined,
  infraObjects: InfraObject[],
) {
  const queryClient = useQueryClient();

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

  const { data: pywellgeoLast, isLoading: pywellgeoLoading } = useQuery({
    queryKey: ['pywellgeoLast', projectId, padId],
    queryFn: () => pywellgeoApi.getLast(projectId!, padId!),
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
  const [geoDraft, setGeoDraft] = useState<PadClusteringPyWellGeoDraft | null>(null);
  const [savedGeoDraft, setSavedGeoDraft] = useState<PadClusteringPyWellGeoDraft | null>(null);
  const [localWellsLocal, setLocalWellsLocal] = useState<PlanVertex[]>([]);
  const [localSketch, setLocalSketch] = useState<PlanShapeSketch | null>(null);
  const [sketchDirty, setSketchDirty] = useState(false);
  const lastServerPadDraftRef = useRef<PadClusteringPadDraft | null>(null);
  const lastPadIdRef = useRef<string | null>(null);
  const sketchDirtyRef = useRef(false);
  sketchDirtyRef.current = sketchDirty;

  const savedPadDraft = useMemo(
    () =>
      pad
        ? draftFromPadSources({
            pad,
            wellsCount: wellsLocal.length,
            earthworkParams: earthworkLast?.params ?? null,
            linkedBottomholes,
          })
        : null,
    [pad, wellsLocal.length, earthworkLast?.params, linkedBottomholes],
  );

  const savedPadDraftKey = useMemo(
    () => padClusteringDraftSourceKey(savedPadDraft),
    [savedPadDraft],
  );

  useEffect(() => {
    if (!pad) {
      setDraft(null);
      setCalcDraft(null);
      setSavedCalcDraft(null);
      setGeoDraft(null);
      setSavedGeoDraft(null);
      setLocalWellsLocal([]);
      setLocalSketch(null);
      setSketchDirty(false);
      lastServerPadDraftRef.current = null;
      lastPadIdRef.current = null;
      return;
    }

    const padChanged = lastPadIdRef.current !== pad.id;
    lastPadIdRef.current = pad.id;
    const serverDraft = savedPadDraft ?? draftFromPad(pad, wellsLocal.length);

    setDraft((prev) => {
      const next = resolvePadClusteringDraftSync(
        prev,
        serverDraft,
        lastServerPadDraftRef.current,
        padChanged,
      );
      if (padClusteringDraftsEqual(next, serverDraft)) {
        lastServerPadDraftRef.current = serverDraft;
      }
      return next;
    });

    const calc = calcDraftFromSources({
      properties: pad.properties as Record<string, unknown>,
      settings: trajectoryLast?.settings,
      envelope,
    });
    setCalcDraft(calc);
    setSavedCalcDraft(calc);
    const geo = pyWellGeoDraftFromSources(pad.properties as Record<string, unknown>, pywellgeoLast ?? undefined);
    setGeoDraft((prev) => {
      if (!prev || padChanged) return geo;
      const prevNodes = prev.trees.reduce((n, t) => n + countTreeNodes(t.tree), 0);
      const geoNodes = geo.trees.reduce((n, t) => n + countTreeNodes(t.tree), 0);
      if (prevNodes > geoNodes) return prev;
      return geo;
    });
    setSavedGeoDraft(geo);

    if (padChanged || !sketchDirtyRef.current) {
      setLocalWellsLocal(wellsLocal);
      if (padChanged) {
        setLocalSketch(null);
        setSketchDirty(false);
      }
    }
  }, [
    pad,
    pad?.id,
    savedPadDraft,
    savedPadDraftKey,
    wellsLocal,
    trajectoryLast?.settings,
    envelope,
    pywellgeoLast,
  ]);

  const activeDraft = draft ?? savedPadDraft ?? (pad ? draftFromPad(pad, wellsLocal.length) : null);
  const activeGeoDraft =
    geoDraft ??
    pyWellGeoDraftFromSources(
      (pad?.properties as Record<string, unknown>) ?? null,
      pywellgeoLast ?? undefined,
    );
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

  const trajectories = useMemo(
    () => trajectoryLast?.trajectories ?? [],
    [trajectoryLast?.trajectories],
  );

  const useLiveLayoutPreview = Boolean(
    layoutPreview && (isLayoutDraftDirty || sketchDirty || layoutPreviewStale),
  );

  const { activeSketch, activeWellsLocal } = resolveActiveLayout({
    useLiveLayoutPreview,
    layoutPreview,
    localSketch,
    sketch,
    sketchDirty,
    localWellsLocal,
    wellsLocal,
  });

  const {
    sceneTrajectories,
    sceneWellsLocal,
    sceneTrajectoriesHidden,
    sceneLayoutCallout,
  } = usePadClusteringEditorScene({
    trajectories,
    wellsLocal,
    activeWellsLocal,
    layoutPreviewStale,
  });

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
    void queryClient.refetchQueries({ queryKey: ['wellTrajectoryProjectGeoJson', projectId] });
    void queryClient.invalidateQueries({ queryKey: ['pywellgeoLast', projectId, padId] });
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

  const patchGeoDraft = useCallback((patch: Partial<PadClusteringPyWellGeoDraft>) => {
    setGeoDraft((prev) => {
      const base =
        prev ??
        pyWellGeoDraftFromSources(
          (pad?.properties as Record<string, unknown>) ?? null,
          pywellgeoLast ?? undefined,
        );
      return { ...base, ...patch };
    });
  }, [pad?.properties, pywellgeoLast]);

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
        const base = prev ?? savedPadDraft ?? draftFromPad(pad, wellsLocal.length);
        return { ...base, ...patch };
      });
    },
    [pad, wellsLocal.length, savedPadDraft],
  );

  const {
    savePadMut,
    generateAndSaveMut,
    generateFromLayoutMut,
    syncBottomholesMut,
    designFromBottomholesMut,
    runClearanceMut,
    saveBottomholeMut,
  } = usePadClusteringEditorMutations({
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
  });

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

  const trajectoryWarnings = trajectoryLast?.warnings ?? [];
  const trajectorySettings = trajectoryLast?.settings ?? null;
  const trajectoryComputedAt = trajectoryLast?.computed_at ?? null;
  const clearancePairs = trajectoryLast?.clearance_pairs ?? [];
  const clearanceComputedAt = trajectoryLast?.clearance_computed_at ?? null;

  const referenceElevationM = Number(activeDraft?.referenceElevationM ?? 0);
  const heightM = Number(activeDraft?.heightM ?? 1);
  const kbM =
    (Number.isFinite(referenceElevationM) ? referenceElevationM : 0) +
    (Number.isFinite(heightM) ? heightM : 0);

  const isGeoDirty = useMemo(() => {
    if (!savedGeoDraft) return false;
    return !pyWellGeoDraftEquals(activeGeoDraft, savedGeoDraft);
  }, [activeGeoDraft, savedGeoDraft]);

  const isCalcDirty = useMemo(() => {
    if (!savedCalcDraft) return false;
    return !calcDraftEquals(activeCalcDraft, savedCalcDraft);
  }, [activeCalcDraft, savedCalcDraft]);

  const isDraftDirty = useMemo(
    () => isPadFormDraftDirty(pad, activeDraft, savedPadDraft),
    [pad, activeDraft, savedPadDraft],
  );

  const isAnyDirty = isDraftDirty || isCalcDirty || isGeoDirty;
  const isLoading = earthworkLoading || trajectoryLoading || pywellgeoLoading;

  return {
    pads,
    pad,
    activeDraft,
    activeCalcDraft,
    patchCalcDraft,
    activeGeoDraft,
    patchGeoDraft,
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
    isGeoDirty,
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
