import type { QueryClient } from '@tanstack/react-query';
import {
  defaultMapDataApi,
  defaultProjectsDataApi,
  defaultProjectsMapSettingsApi,
} from '../lib/api';
import { MAP_INFRA_STALE_MS } from '../lib/mapBboxUtils';
import { queryKeys } from '../lib/queryKeys';

let mapPageBundlePrefetch: Promise<unknown> | null = null;

/** Подгружает JS-чанк MapPage (+ map2d/map3d через Vite manualChunks). */
export function prefetchMapPageBundle(): void {
  if (!mapPageBundlePrefetch) {
    mapPageBundlePrefetch = import('../pages/MapPage');
  }
}

/** Откладывает prefetch до idle — не мешает первому рендеру текущей страницы. */
export function scheduleMapPageBundlePrefetch(): void {
  if (typeof window === 'undefined') return;
  const run = () => prefetchMapPageBundle();
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(run, { timeout: 4000 });
  } else {
    window.setTimeout(run, 1500);
  }
}

/** Прогревает типичные запросы карты, чтобы UI не ждал API после загрузки чанка. */
export function prefetchMapPageData(queryClient: QueryClient, projectId: string): void {
  const staleTime = MAP_INFRA_STALE_MS;
  void queryClient.prefetchQuery({
    queryKey: queryKeys.pois(projectId),
    queryFn: () => defaultProjectsDataApi.getPois(projectId),
    staleTime,
  });
  void queryClient.prefetchQuery({
    queryKey: queryKeys.layers(projectId),
    queryFn: () => defaultMapDataApi.getLayers(projectId),
    staleTime,
  });
  void queryClient.prefetchQuery({
    queryKey: ['distance-defaults', projectId],
    queryFn: () => defaultProjectsMapSettingsApi.getDistanceDefaults(projectId),
    staleTime,
  });
  void queryClient.prefetchQuery({
    queryKey: ['map3d-custom-models', projectId],
    queryFn: () => defaultMapDataApi.listMap3dCustomModels(projectId),
    staleTime,
  });
}

/** JS + данные карты — вызывать при hover/focus на пункт «Карта». */
export function prefetchMapPage(queryClient: QueryClient, projectId: string | null | undefined): void {
  prefetchMapPageBundle();
  if (projectId) prefetchMapPageData(queryClient, projectId);
}
