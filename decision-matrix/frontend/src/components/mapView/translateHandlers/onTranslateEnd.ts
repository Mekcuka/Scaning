import type Translate from 'ol/interaction/Translate';
import type { MapFeatureSelection } from '../types';
import type { MapSetupContext } from '../mapSetupContext';
import { readFeatureGeometry } from './readFeatureGeometry';

export function bindTranslateEndHandler(ctx: MapSetupContext, translate: Translate) {
  const { refs, interactions } = ctx;
  const { select } = interactions;
  const {
    editModeRef,
    selectModeRef,
    translateSessionRef,
    translateStartGeomsRef,
    linkedLineDragRef,
    suppressDataSyncRef,
    syncInfraDataToLayersRef,
    onBatchGeometryChangeRef,
  } = refs;

  translate.on('translateend', () => {
    const sessionId = translateSessionRef.current;
    const finishSession = () => {
      linkedLineDragRef.current = null;
      suppressDataSyncRef.current = false;
      syncInfraDataToLayersRef.current?.();
    };
    if (!editModeRef.current || selectModeRef.current !== 'box') {
      finishSession();
      return;
    }
    const changes: {
      sel: MapFeatureSelection;
      lon: number;
      lat: number;
      coords?: number[][];
    }[] = [];
    select.getFeatures().forEach((f) => {
      const parsed = readFeatureGeometry(f);
      if (!parsed) return;
      const start = translateStartGeomsRef.current.get(parsed.sel.id);
      if (!start) return;
      const moved =
        Math.abs(parsed.lon - start.lon) > 1e-9 ||
        Math.abs(parsed.lat - start.lat) > 1e-9 ||
        (parsed.coords &&
          start.coords &&
          (parsed.coords.length !== start.coords.length ||
            parsed.coords.some(
              (c, i) =>
                Math.abs(c[0]! - start.coords![i]![0]!) > 1e-9 ||
                Math.abs(c[1]! - start.coords![i]![1]!) > 1e-9,
            )));
      if (moved) changes.push(parsed);
    });
    translateStartGeomsRef.current.clear();
    if (changes.length === 0) {
      finishSession();
      return;
    }
    const save = onBatchGeometryChangeRef.current?.(changes);
    if (save != null && typeof (save as Promise<void>).then === 'function') {
      (save as Promise<void>).finally(finishSession);
    } else {
      finishSession();
    }
    void sessionId;
  });
}
