import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { padEarthworkApi, type PadTerrainMode } from '../../lib/api/padEarthworkApi';
import {
  isPlanPolygon,
  isPlanRectangle,
  isPolygonSketchClosed,
  sketchToApiPayload,
} from '../../lib/padEarthworkSketch';
import { padWellFieldsFromForm } from '../../lib/infraPadWells';
import { clampNdsDeg, DEFAULT_PAD_NDS_DEG, parseNdsDeg } from '../../lib/infraPadEarthwork';
import { maybeRegenerateTrajectoriesAfterLayoutChange } from '../../lib/wellTrajectoryLayoutRegenerate';
import { wellTrajectoryQueryKeys } from '../../hooks/useWellTrajectoryGeoJson';
import {
  cloneGeneratorSnapshot,
  parseHeightRef,
  type PadEarthworkSketchModalProps,
} from './padEarthworkSketchModalState';
import type { PadEarthworkSketchCoreState } from './usePadEarthworkSketchState';

export type UsePadEarthworkSketchMutationsArgs = {
  projectId: string;
  objectId: string;
  rotationDeg: string;
  onApplyToFields: PadEarthworkSketchModalProps['onApplyToFields'];
  onComputeSuccess: PadEarthworkSketchModalProps['onComputeSuccess'];
  onSaveSuccess?: PadEarthworkSketchModalProps['onSaveSuccess'];
  core: PadEarthworkSketchCoreState;
};

export function usePadEarthworkSketchMutations({
  projectId,
  objectId,
  onApplyToFields,
  onComputeSuccess,
  onSaveSuccess,
  core,
}: UsePadEarthworkSketchMutationsArgs) {
  const queryClient = useQueryClient();

  const {
    showGenerator,
    sketch,
    setSketch,
    localHeight,
    localRef,
    setResult,
    setError,
    setSketchDirty,
    setSaveMessage,
    envelopeEnabled,
    wrapWidthM,
    wellsLocal,
    setWellsLocal,
    generatorSnapshotRef,
    baselineWellsRef,
    generatorFields,
    setGeneratorFields,
    localDemAssetId,
    syncCardFields,
    setFitViewNonce,
  } = core;

  const buildTerrain = useCallback((): PadTerrainMode => {
    if (localDemAssetId) {
      return { mode: 'dem', dem_asset_id: localDemAssetId };
    }
    return { mode: 'flat' };
  }, [localDemAssetId]);

  const computeMutation = useMutation({
    mutationFn: async () => {
      const heightRef = parseHeightRef(localHeight, localRef);
      if (!heightRef) throw new Error('Укажите высоту насыпи и опорную отметку');
      if (isPlanPolygon(sketch) && !isPolygonSketchClosed(sketch)) {
        throw new Error('Добавьте минимум 3 вершины для расчёта полигона');
      }
      return padEarthworkApi.compute(projectId, objectId, {
        sketch: sketchToApiPayload(sketch),
        params: heightRef,
        envelope: envelopeEnabled
          ? { enabled: true, wrap_width_m: wrapWidthM }
          : undefined,
        terrain: buildTerrain(),
      });
    },
    onSuccess: (data) => {
      setResult(data);
      setError(null);
      onComputeSuccess(data);
    },
    onError: (err: Error) => setError(err.message || 'Ошибка расчёта'),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const previousWells = baselineWellsRef.current.map((w) => ({ ...w }));
      const heightRef = parseHeightRef(localHeight, localRef);
      if (!heightRef) throw new Error('Укажите высоту насыпи и опорную отметку');
      if (isPlanPolygon(sketch) && !isPolygonSketchClosed(sketch)) {
        throw new Error('Добавьте минимум 3 вершины для сохранения полигона');
      }
      const nextWells =
        showGenerator && wellsLocal.length > 0
          ? wellsLocal.map((w) => ({ east_m: w.east_m, north_m: w.north_m }))
          : [];
      await padEarthworkApi.saveSketch(projectId, objectId, {
        sketch: sketchToApiPayload(sketch),
        params: heightRef,
        envelope: envelopeEnabled
          ? { enabled: true, wrap_width_m: wrapWidthM }
          : { enabled: false, wrap_width_m: wrapWidthM },
        wells_local: showGenerator && wellsLocal.length > 0 ? wellsLocal : undefined,
        rotation_deg: showGenerator
          ? parseNdsDeg(generatorFields.rotationDeg)
          : isPlanRectangle(sketch)
            ? sketch.rotation_deg
            : parseNdsDeg(core.rotationDeg),
      });
      return { previousWells, nextWells };
    },
    onSuccess: async ({ previousWells, nextWells }) => {
      setSketchDirty(false);
      setSaveMessage('Схема сохранена. Объёмы обновляются только по кнопке «Рассчитать».');
      setError(null);
      syncCardFields();
      void queryClient.invalidateQueries({ queryKey: ['padEarthworkLast', projectId, objectId] });
      void queryClient.invalidateQueries({ queryKey: ['infra', projectId] });
      if (nextWells.length > 0) {
        const regenerated = await maybeRegenerateTrajectoriesAfterLayoutChange({
          projectId,
          padId: objectId,
          previousWells,
          nextWells,
        });
        if (regenerated) {
          void queryClient.invalidateQueries({
            queryKey: wellTrajectoryQueryKeys.last(projectId, objectId),
          });
          void queryClient.invalidateQueries({
            queryKey: wellTrajectoryQueryKeys.geoJson(projectId, objectId),
          });
          void queryClient.invalidateQueries({ queryKey: ['wellTrajectoryProjectGeoJson', projectId] });
        }
        baselineWellsRef.current = nextWells;
      }
      onSaveSuccess?.();
    },
    onError: (err: Error) => setError(err.message || 'Ошибка сохранения'),
  });

  const buildGenerateBody = useCallback(() => {
    const fields = padWellFieldsFromForm({
      padWellCount: generatorFields.padWellCount,
      padWellsPerGroup: generatorFields.padWellsPerGroup,
      padWellSpacingM: generatorFields.padWellSpacingM,
      padGroupSpacingM: generatorFields.padGroupSpacingM,
      padMarginLeftM: generatorFields.padMarginLeftM,
      padMarginBottomM: generatorFields.padMarginBottomM,
      padMarginTopM: generatorFields.padMarginTopM,
      padMarginEndM: generatorFields.padMarginEndM,
    });
    const rotRaw = generatorFields.rotationDeg.trim().replace(',', '.');
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
  }, [generatorFields]);

  const generateMutation = useMutation({
    mutationFn: async () => padEarthworkApi.generateSketch(projectId, objectId, buildGenerateBody()),
    onSuccess: (data) => {
      setSketch(data.sketch);
      setWellsLocal(data.wells_local);
      generatorSnapshotRef.current = cloneGeneratorSnapshot(data.sketch, data.wells_local);
      setSketchDirty(true);
      setSaveMessage(null);
      setResult(null);
      setError(null);
      onApplyToFields({
        lengthM: String(data.length_m),
        widthM: String(data.width_m),
        rotationDeg: String(data.rotation_deg),
        heightM: localHeight,
        referenceElevationM: localRef,
      });
      setGeneratorFields((prev) => ({ ...prev, rotationDeg: String(data.rotation_deg) }));
      setFitViewNonce((n) => n + 1);
    },
    onError: (err: Error) => setError(err.message || 'Ошибка автогенерации'),
  });

  return {
    computeMutation,
    saveMutation,
    generateMutation,
  };
}
