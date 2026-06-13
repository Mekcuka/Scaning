import { useCallback, useEffect, useState } from 'react';
import { isMap3dEnabled } from '../lib/map3d/map3dConfig';

export type MapDisplayMode = '2d' | '3d' | 'footprints';

const STORAGE_KEY = 'dm-map-display-mode';

function loadPersistedMode(): MapDisplayMode {
  try {
    // UX: при первом открытии вкладки «Карта» всегда показываем 2D.
    return '2d';
  } catch {
    return '2d';
  }
}

export function useMapDisplayMode() {
  const is3dEnabled = isMap3dEnabled();
  const [displayMode, setDisplayModeState] = useState<MapDisplayMode>(() =>
    is3dEnabled ? loadPersistedMode() : '2d',
  );

  useEffect(() => {
    if (!is3dEnabled && displayMode === '3d') setDisplayModeState('2d');
  }, [is3dEnabled, displayMode]);

  const setDisplayMode = useCallback(
    (mode: MapDisplayMode) => {
      if (!is3dEnabled && mode === '3d') return;
      setDisplayModeState(mode);
      try {
        localStorage.setItem(STORAGE_KEY, mode);
      } catch {
        /* private mode */
      }
    },
    [is3dEnabled],
  );

  const mapIn3d = is3dEnabled && displayMode === '3d';
  const mapInFootprints = displayMode === 'footprints';

  return {
    is3dEnabled,
    displayMode,
    setDisplayMode,
    mapIn3d,
    mapInFootprints,
  };
}
