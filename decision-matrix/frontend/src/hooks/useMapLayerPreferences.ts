import { useCallback, useEffect, useState } from 'react';
import {
  defaultMapLayerPreferences,
  loadMapLayerPreferences,
  saveMapLayerPreferences,
  type MapLayerOpenSections,
  type MapLayerPreferences,
} from '../lib/mapLayerPreferences';

export function useMapLayerPreferences(projectId: string | null) {
  const [prefs, setPrefs] = useState<MapLayerPreferences>(() =>
    loadMapLayerPreferences(projectId),
  );

  useEffect(() => {
    setPrefs(loadMapLayerPreferences(projectId));
  }, [projectId]);

  useEffect(() => {
    saveMapLayerPreferences(projectId, prefs);
  }, [projectId, prefs]);

  const patchPrefs = useCallback((patch: Partial<MapLayerPreferences>) => {
    setPrefs((prev) => ({ ...prev, ...patch }));
  }, []);

  const setOpenSections = useCallback((openSections: MapLayerOpenSections) => {
    patchPrefs({ openSections });
  }, [patchPrefs]);

  return { prefs, setPrefs, patchPrefs, setOpenSections };
}
