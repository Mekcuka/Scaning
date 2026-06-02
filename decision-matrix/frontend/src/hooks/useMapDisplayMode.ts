import { useCallback, useEffect, useState } from 'react';
import { isMap3dEnabled } from '../lib/map3d/map3dConfig';

export type MapDisplayMode = '2d' | '3d';

const STORAGE_KEY = 'dm-map-display-mode';

function loadPersistedMode(): MapDisplayMode {
  try {
    // UX: при первом открытии вкладки «Карта» всегда показываем 2D.
    // Режим 3D не включается автоматически из прошлого значения.
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
    if (!is3dEnabled) setDisplayModeState('2d');
  }, [is3dEnabled]);

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

  return {
    is3dEnabled,
    displayMode,
    setDisplayMode,
    mapIn3d,
  };
}
