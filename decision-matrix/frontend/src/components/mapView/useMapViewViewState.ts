import { useEffect } from 'react';
import { fromLonLat } from 'ol/proj';
import { loadMapViewState, resolveInitialMapView } from '../../lib/mapViewState';
import type { MapViewRefs } from './mapViewRefs';
import type { MapViewProps } from './types';

export function useMapViewViewState(
  refs: MapViewRefs,
  {
    projectId,
    viewStateId,
    viewStateScope = null,
    persistViewState = true,
    showBasemap = true,
  }: Pick<MapViewProps, 'viewStateId' | 'viewStateScope' | 'persistViewState' | 'showBasemap'> & {
    projectId: string | null | undefined;
  },
): void {
  const { mapRef, prevProjectIdForViewRef, basemapLayerRef } = refs;

  useEffect(() => {
    const map = mapRef.current;
    const vid = viewStateId;
    if (!map || !vid || !persistViewState) return;

    if (prevProjectIdForViewRef.current === undefined) {
      prevProjectIdForViewRef.current = projectId ?? null;
      return;
    }
    const pid = projectId ?? null;
    if (prevProjectIdForViewRef.current === pid) return;
    prevProjectIdForViewRef.current = pid;

    const saved = loadMapViewState(vid, projectId ?? null, viewStateScope);
    const view = map.getView();
    if (saved) {
      view.setCenter(fromLonLat([saved.centerLon, saved.centerLat]));
      view.setZoom(saved.zoom);
    } else {
      const initial = resolveInitialMapView(vid, projectId ?? null, viewStateScope);
      view.setCenter(fromLonLat([initial.centerLon, initial.centerLat]));
      view.setZoom(initial.zoom);
    }
  }, [projectId, viewStateId, persistViewState]);

  useEffect(() => {
    const map = mapRef.current;
    const vid = viewStateId;
    if (!map || !vid || !viewStateScope || !persistViewState) return;

    const saved = loadMapViewState(vid, projectId ?? null, viewStateScope);
    if (!saved) return;
    const view = map.getView();
    view.setCenter(fromLonLat([saved.centerLon, saved.centerLat]));
    view.setZoom(saved.zoom);
  }, [viewStateScope, projectId, viewStateId, persistViewState]);

  useEffect(() => {
    const layer = basemapLayerRef.current;
    if (!layer) return;
    layer.setVisible(showBasemap);
  }, [showBasemap]);
}
