import { useCallback, useEffect, useState, type MutableRefObject } from 'react';
import type { DrawMode } from '../components/MapView';
import type { MapView3DHandle } from '../components/MapView3D';
import {
  isMaptilerTerrainAvailable,
  MAP3D_TERRAIN_TOAST_KEY,
} from '../lib/map3d/map3dConfig';
import {
  loadMapViewState,
  resolveInitialMapView3d,
  saveMapViewState,
  type SavedMapViewState,
} from '../lib/mapViewState';

export type UseMap3dDisplayParams = {
  projectId: string | undefined;
  drawMode: DrawMode;
  setDrawMode: (mode: DrawMode) => void;
  mapIn3d: boolean;
  setMapDisplayMode: (mode: '2d' | '3d') => void;
  pushToast: (kind: 'success' | 'error' | 'info', message: string) => void;
  map3dRef: MutableRefObject<MapView3DHandle | null>;
  last2dViewRef: MutableRefObject<SavedMapViewState | null>;
  onClearDrawingForModeSwitch: () => void;
  setPointMenuOpen: (open: boolean) => void;
  setLineMenuOpen: (open: boolean) => void;
};

export function useMap3dDisplay({
  projectId,
  drawMode,
  setDrawMode,
  mapIn3d,
  setMapDisplayMode,
  pushToast,
  map3dRef,
  last2dViewRef,
  onClearDrawingForModeSwitch,
  setPointMenuOpen,
  setLineMenuOpen,
}: UseMap3dDisplayParams) {
  const [map3dKeepMounted, setMap3dKeepMounted] = useState(false);

  useEffect(() => {
    if (mapIn3d) setMap3dKeepMounted(true);
  }, [mapIn3d]);

  const switchMapDisplayMode = useCallback(
    (mode: '2d' | '3d') => {
      if (mode === '3d' && drawMode !== 'select') {
        setDrawMode('select');
        onClearDrawingForModeSwitch();
        setPointMenuOpen(false);
        setLineMenuOpen(false);
        pushToast('info', 'Рисование доступно только в режиме 2D');
      }
      if (mode === '3d') {
        const base =
          last2dViewRef.current ??
          (projectId ? loadMapViewState('main', projectId) : null) ?? {
            centerLon: 37.6176,
            centerLat: 55.7558,
            zoom: 9,
          };
        const saved3d = resolveInitialMapView3d('main', projectId ?? null);
        setMapDisplayMode('3d');
        if (import.meta.env.DEV && !isMaptilerTerrainAvailable()) {
          try {
            if (!sessionStorage.getItem(MAP3D_TERRAIN_TOAST_KEY)) {
              sessionStorage.setItem(MAP3D_TERRAIN_TOAST_KEY, '1');
              pushToast('info', 'Задайте VITE_MAPTILER_KEY в frontend/.env для рельефа');
            }
          } catch {
            /* sessionStorage unavailable */
          }
        }
        requestAnimationFrame(() => {
          map3dRef.current?.jumpToView({
            ...base,
            pitch: saved3d.pitch,
            bearing: saved3d.bearing,
          });
          requestAnimationFrame(() => {
            map3dRef.current?.resize();
          });
        });
        return;
      }
      const snap = map3dRef.current?.getViewSnapshot();
      if (snap && projectId) {
        saveMapViewState('main', projectId, {
          centerLon: snap.centerLon,
          centerLat: snap.centerLat,
          zoom: snap.zoom,
        });
      }
      setMapDisplayMode('2d');
    },
    [
      drawMode,
      pushToast,
      projectId,
      setMapDisplayMode,
      setDrawMode,
      map3dRef,
      last2dViewRef,
      onClearDrawingForModeSwitch,
      setPointMenuOpen,
      setLineMenuOpen,
    ],
  );

  return { map3dKeepMounted, switchMapDisplayMode };
}
