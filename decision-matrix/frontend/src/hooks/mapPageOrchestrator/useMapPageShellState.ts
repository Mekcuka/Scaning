import { useCallback, useEffect, useRef, useState } from 'react';
import type { MapView3DHandle } from '../../components/MapView3D';
import { type SavedMapViewState } from '../../lib/mapViewState';

export function useMapPageShellState() {
  const map3dRef = useRef<MapView3DHandle | null>(null);
  const last2dViewRef = useRef<SavedMapViewState | null>(null);
  const mapCanvasRef = useRef<HTMLDivElement>(null);
  const [mapLayersOpen, setMapLayersOpen] = useState(false);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [mapScaleLabel, setMapScaleLabel] = useState('—');
  const [mapScaleDenominator, setMapScaleDenominator] = useState(0);

  const toggleMapFullscreen = useCallback(async () => {
    const el = mapCanvasRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      /* ignore unsupported fullscreen */
    }
  }, []);

  useEffect(() => {
    const onFullscreenChange = () =>
      setMapFullscreen(document.fullscreenElement === mapCanvasRef.current);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  return {
    map3dRef,
    last2dViewRef,
    mapCanvasRef,
    mapLayersOpen,
    setMapLayersOpen,
    mapFullscreen,
    toggleMapFullscreen,
    mapScaleLabel,
    setMapScaleLabel,
    mapScaleDenominator,
    setMapScaleDenominator,
  };
}
