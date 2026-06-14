import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { padEarthworkApi, type PadEarthworkComputeResult, type PadTerrainMode } from '../../lib/api/padEarthworkApi';
import type { InfraObject } from '../../lib/api';
import {
  clampNdsDeg,
  DEFAULT_PAD_NDS_DEG,
  envelopeFromObject,
  hasSavedPadSketch,
  padParamsFromObject,
  readDemStatusFromProperties,
  resolveGeneratorNdsDeg,
  sketchSavedAtFromObject,
} from '../../lib/infraPadEarthwork';
import { parseSketchFromLast, parseWellsLocalFromLast, planFromFormFields } from '../../lib/padEarthworkSketch';
import { formatPadDemError, parsePositive } from './infraPadEarthworkSectionUtils';

export type UseInfraPadEarthworkSectionArgs = {
  projectId: string;
  infraObject: InfraObject;
  padMarginLeftM: string;
  padMarginBottomM: string;
  padMarginTopM: string;
  padMarginEndM: string;
  padWellCount: string;
  padWellsPerGroup: string;
  padWellSpacingM: string;
  padGroupSpacingM: string;
};

export function useInfraPadEarthworkSection({
  projectId,
  infraObject,
  padMarginLeftM,
  padMarginBottomM,
  padMarginTopM,
  padMarginEndM,
  padWellCount,
  padWellsPerGroup,
  padWellSpacingM,
  padGroupSpacingM,
}: UseInfraPadEarthworkSectionArgs) {
  const queryClient = useQueryClient();
  const initial = padParamsFromObject(infraObject);
  const [lengthM, setLengthM] = useState(initial.lengthM);
  const [widthM, setWidthM] = useState(initial.widthM);
  const [heightM, setHeightM] = useState(initial.heightM);
  const [rotationDeg, setRotationDeg] = useState(initial.rotationDeg);
  const [referenceElevationM, setReferenceElevationM] = useState(initial.referenceElevationM);
  const [result, setResult] = useState<PadEarthworkComputeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sketchOpen, setSketchOpen] = useState(false);
  const [terrainMode, setTerrainMode] = useState<'flat' | 'dem'>('flat');

  const { data: last } = useQuery({
    queryKey: ['padEarthworkLast', projectId, infraObject.id],
    queryFn: () => padEarthworkApi.getLast(projectId, infraObject.id),
    enabled: Boolean(projectId && infraObject.id),
  });

  const savedSketch = useMemo(
    () => parseSketchFromLast(last?.sketch ?? null),
    [last?.sketch],
  );
  const savedWellsLocal = useMemo(
    () =>
      parseWellsLocalFromLast(
        last?.wells_local ?? (infraObject.properties as Record<string, unknown> | undefined)?.pad_wells_local_json,
      ),
    [last?.wells_local, infraObject.properties],
  );
  const savedEnvelope = useMemo(
    () => last?.envelope ?? envelopeFromObject(infraObject.properties),
    [last?.envelope, infraObject.properties],
  );
  const demStatus = useMemo(
    () => last?.dem ?? readDemStatusFromProperties(infraObject.properties as Record<string, unknown> | undefined),
    [last?.dem, infraObject.properties],
  );

  useEffect(() => {
    if (sketchOpen) return;
    const p = padParamsFromObject(infraObject);
    setLengthM(p.lengthM);
    setWidthM(p.widthM);
    setHeightM(p.heightM);
    setRotationDeg(p.rotationDeg);
    setReferenceElevationM(p.referenceElevationM);
  }, [infraObject, sketchOpen]);

  useEffect(() => {
    if (sketchOpen) return;
    if (last?.params) {
      const p = last.params;
      setLengthM(String(p.length_m));
      setWidthM(String(p.width_m));
      setHeightM(String(p.height_m));
      setRotationDeg(
        resolveGeneratorNdsDeg(
          String(p.rotation_deg ?? DEFAULT_PAD_NDS_DEG),
          savedWellsLocal.length > 0,
        ),
      );
      setReferenceElevationM(String(p.reference_elevation_m));
    }
    if (last?.result) setResult(last.result);
  }, [last, sketchOpen, savedWellsLocal.length]);

  const skipPadWellParamsReset = useRef(true);
  useEffect(() => {
    if (skipPadWellParamsReset.current) {
      skipPadWellParamsReset.current = false;
      return;
    }
    setResult(null);
  }, [
    padWellCount,
    padWellsPerGroup,
    padWellSpacingM,
    padGroupSpacingM,
    padMarginLeftM,
    padMarginBottomM,
    padMarginTopM,
    padMarginEndM,
  ]);

  const buildParams = useCallback(() => {
    const length = parsePositive(lengthM);
    const width = parsePositive(widthM);
    const height = parsePositive(heightM);
    const refRaw = referenceElevationM.trim().replace(',', '.');
    const ref = refRaw === '' ? 0 : Number(refRaw);
    const rotRaw = rotationDeg.trim().replace(',', '.');
    const rotation = rotRaw === '' ? DEFAULT_PAD_NDS_DEG : Number(rotRaw);
    if (length == null || width == null || height == null || !Number.isFinite(ref)) {
      return null;
    }
    return {
      length_m: length,
      width_m: width,
      height_m: height,
      rotation_deg: Number.isFinite(rotation) ? clampNdsDeg(rotation) : DEFAULT_PAD_NDS_DEG,
      reference_elevation_m: ref,
    };
  }, [lengthM, widthM, heightM, referenceElevationM, rotationDeg]);

  const buildTerrain = useCallback((): PadTerrainMode => {
    if (terrainMode === 'dem') {
      return { mode: 'dem', dem_asset_id: demStatus?.asset_id ?? undefined };
    }
    return { mode: 'flat' };
  }, [terrainMode, demStatus?.asset_id]);

  const demAvailable = Boolean(demStatus?.asset_id);
  const demSketch = useMemo(
    () => savedSketch ?? planFromFormFields(lengthM, widthM, rotationDeg),
    [savedSketch, lengthM, widthM, rotationDeg],
  );
  const demPreviewParams = useMemo(() => {
    const p = buildParams();
    if (!p) return null;
    return { height_m: p.height_m, reference_elevation_m: p.reference_elevation_m };
  }, [buildParams]);

  const invalidatePadQueries = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['padEarthworkLast', projectId, infraObject.id] });
    void queryClient.invalidateQueries({ queryKey: ['infra', projectId] });
  }, [queryClient, projectId, infraObject.id]);

  const fetchDemMutation = useMutation({
    mutationFn: async () => {
      const params = buildParams();
      if (!params) throw new Error('Укажите длину, ширину, высоту и опорную отметку');
      return padEarthworkApi.fetchDem(projectId, infraObject.id, { params });
    },
    onSuccess: (data) => {
      setError(null);
      setReferenceElevationM(String(data.reference_elevation_m));
      invalidatePadQueries();
    },
    onError: (err: Error) => setError(formatPadDemError(err.message)),
  });

  const computeMutation = useMutation({
    mutationFn: async () => {
      const params = buildParams();
      if (!params) throw new Error('Укажите длину, ширину, высоту и опорную отметку');
      return padEarthworkApi.compute(projectId, infraObject.id, {
        params,
        terrain: buildTerrain(),
      });
    },
    onSuccess: (data) => {
      setResult(data);
      setError(null);
      invalidatePadQueries();
    },
    onError: (err: Error) => setError(formatPadDemError(err.message) || 'Ошибка расчёта'),
  });

  const fillM3 = result?.volumes.fill_m3;
  const sketchSavedAt = last?.sketch_saved_at ?? sketchSavedAtFromObject(infraObject.properties);
  const hasSavedSketch = Boolean(savedSketch) || hasSavedPadSketch(infraObject.properties);

  return {
    lengthM,
    setLengthM,
    widthM,
    setWidthM,
    heightM,
    setHeightM,
    rotationDeg,
    setRotationDeg,
    referenceElevationM,
    setReferenceElevationM,
    result,
    setResult,
    error,
    setError,
    sketchOpen,
    setSketchOpen,
    terrainMode,
    setTerrainMode,
    savedSketch,
    savedWellsLocal,
    savedEnvelope,
    demStatus,
    demAvailable,
    demSketch,
    demPreviewParams,
    fetchDemMutation,
    computeMutation,
    fillM3,
    sketchSavedAt,
    hasSavedSketch,
    invalidatePadQueries,
  };
}

export type InfraPadEarthworkSectionModel = ReturnType<typeof useInfraPadEarthworkSection>;
