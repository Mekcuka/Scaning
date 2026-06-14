import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { padEarthworkApi } from '../../lib/api/padEarthworkApi';
import { sketchToApiPayload, type PlanShapeSketch } from '../../lib/padEarthworkSketch';
import type { PadEarthworkSketchTabId } from './padEarthworkSketchModalState';
import { parseHeightRef } from './padEarthworkSketchModalState';

export type UsePadEarthworkSketchDemPreviewArgs = {
  projectId: string;
  objectId: string;
  readOnly: boolean;
  tab: PadEarthworkSketchTabId;
  sketch: PlanShapeSketch;
  localHeight: string;
  localRef: string;
  localDemAssetId: string | null;
  showDemOverlay: boolean;
  setShowDemOverlay: (value: boolean) => void;
  setLocalDemAssetId: (value: string | null) => void;
  setLocalRef: (value: string) => void;
  setError: (value: string | null) => void;
};

export function usePadEarthworkSketchDemPreview({
  projectId,
  objectId,
  readOnly,
  tab,
  sketch,
  localHeight,
  localRef,
  localDemAssetId,
  showDemOverlay,
  setShowDemOverlay,
  setLocalDemAssetId,
  setLocalRef,
  setError,
}: UsePadEarthworkSketchDemPreviewArgs) {
  const queryClient = useQueryClient();
  const [debouncedPreviewKey, setDebouncedPreviewKey] = useState('');

  const demAvailable = Boolean(localDemAssetId);
  const heightRefForPreview = parseHeightRef(localHeight, localRef);

  const previewRequestKey = useMemo(
    () =>
      JSON.stringify({
        sketch: sketchToApiPayload(sketch),
        params: heightRefForPreview,
      }),
    [sketch, heightRefForPreview],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedPreviewKey(previewRequestKey), 400);
    return () => window.clearTimeout(timer);
  }, [previewRequestKey]);

  const previewRequestBody = useMemo(() => {
    try {
      return JSON.parse(debouncedPreviewKey) as {
        sketch: ReturnType<typeof sketchToApiPayload>;
        params: { height_m: number; reference_elevation_m: number } | null;
      };
    } catch {
      return null;
    }
  }, [debouncedPreviewKey]);

  const demPreviewQuery = useQuery({
    queryKey: ['padDemPreview', projectId, objectId, debouncedPreviewKey, localDemAssetId],
    queryFn: () =>
      padEarthworkApi.fetchDemPreview(projectId, objectId, {
        sketch: previewRequestBody?.sketch,
        params: previewRequestBody?.params ?? undefined,
      }),
    enabled:
      demAvailable &&
      Boolean(previewRequestBody?.params) &&
      debouncedPreviewKey.length > 0 &&
      ((tab === 'plan' && showDemOverlay) || tab === 'scene3d'),
    staleTime: 30_000,
    retry: false,
  });

  const fetchDemMutation = useMutation({
    mutationFn: async () => {
      const params = heightRefForPreview;
      if (!params) throw new Error('Укажите высоту насыпи и опорную отметку');
      return padEarthworkApi.fetchDem(projectId, objectId, {
        sketch: sketchToApiPayload(sketch),
        params,
      });
    },
    onSuccess: (data) => {
      setLocalDemAssetId(data.dem_asset_id);
      setLocalRef(String(data.reference_elevation_m));
      setShowDemOverlay(true);
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['padEarthworkLast', projectId, objectId] });
      void queryClient.invalidateQueries({ queryKey: ['infra', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['padDemPreview', projectId, objectId] });
    },
    onError: (err: Error) => setError(err.message || 'Ошибка загрузки DEM'),
  });

  const demToolbarProps = {
    showDemOverlay,
    onShowDemOverlayChange: setShowDemOverlay,
    demAvailable,
    onFetchDem: () => fetchDemMutation.mutate(),
    fetchDemPending: fetchDemMutation.isPending,
    readOnly,
  };

  const demPreviewData =
    tab === 'scene3d'
      ? demAvailable
        ? demPreviewQuery.data ?? null
        : null
      : showDemOverlay
        ? demPreviewQuery.data ?? null
        : null;
  const demPreviewLoading =
    (tab === 'scene3d' || showDemOverlay) &&
    (demPreviewQuery.isFetching || debouncedPreviewKey !== previewRequestKey);

  return {
    demAvailable,
    debouncedPreviewKey,
    previewRequestKey,
    demToolbarProps,
    demPreviewData,
    demPreviewLoading,
  };
}
