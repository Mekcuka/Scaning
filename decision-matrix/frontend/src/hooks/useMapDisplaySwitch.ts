import { useCallback, type MutableRefObject } from 'react';
import type { DrawMode } from '../components/MapView';
import type { MapView3DHandle } from '../components/MapView3D';
import type { MapDisplayMode } from './useMapDisplayMode';
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

export type UseMapDisplaySwitchParams = {
  projectId: string | undefined;
  drawMode: DrawMode;
  setDrawMode: (mode: DrawMode) => void;
  mapIn3d: boolean;
  setMapDisplayMode: (mode: MapDisplayMode) => void;
  pushToast: (kind: 'success' | 'error' | 'info', message: string) => void;
  map3dRef: MutableRefObject<MapView3DHandle | null>;
  last2dViewRef: MutableRefObject<SavedMapViewState | null>;
  onClearDrawingForModeSwitch: () => void;
  setPointMenuOpen: (open: boolean) => void;
  setLineMenuOpen: (open: boolean) => void;
};

/** @deprecated use useMapDisplaySwitch */
export type UseMap3dDisplayParams = UseMapDisplaySwitchParams;

export function useMapDisplaySwitch({
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
}: UseMapDisplaySwitchParams) {
  const switchToOlMode = useCallback(
    (mode: '2d' | 'footprints') => {
      const snap = map3dRef.current?.getViewSnapshot();
      if (snap && projectId) {
        saveMapViewState('main', projectId, {
          centerLon: snap.centerLon,
          centerLat: snap.centerLat,
          zoom: snap.zoom,
        });
      }
      setMapDisplayMode(mode);
    },
    [projectId, setMapDisplayMode, map3dRef],
  );

  const switchMapDisplayMode = useCallback(
    (mode: MapDisplayMode) => {
      if (mode === 'footprints') {
        switchToOlMode('footprints');
        return;
      }
      if (mode === '2d') {
        switchToOlMode('2d');
        return;
      }
      if (drawMode !== 'select') {
        setDrawMode('select');
        onClearDrawingForModeSwitch();
        setPointMenuOpen(false);
        setLineMenuOpen(false);
        pushToast('info', 'Рисование доступно только в режиме 2D');
      }
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
      switchToOlMode,
    ],
  );

  return { switchMapDisplayMode };
}

/** @deprecated use useMapDisplaySwitch */
export function useMap3dDisplay(params: UseMapDisplaySwitchParams) {
  return useMapDisplaySwitch(params);
}
