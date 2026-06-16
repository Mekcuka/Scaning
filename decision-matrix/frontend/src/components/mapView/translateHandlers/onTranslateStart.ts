import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { transform } from 'ol/proj';
import type Translate from 'ol/interaction/Translate';
import type { LinkedLineDragState } from '../types';
import type { MapSetupContext } from '../mapSetupContext';
import { collectLinkedLinesForInfraMapPoint } from './collectLinkedLinesForPoint';
import { readFeatureGeometry } from './readFeatureGeometry';

export function bindTranslateStartHandler(ctx: MapSetupContext, translate: Translate) {
  const { refs, interactions } = ctx;
  const { select } = interactions;
  const {
    lineSourceRef,
    infraObjectsRef,
    editModeRef,
    selectModeRef,
    translateSessionRef,
    translateStartGeomsRef,
    linkedLineDragRef,
    suppressDataSyncRef,
  } = refs;

  translate.on('translatestart', () => {
    const sessionId = ++translateSessionRef.current;
    suppressDataSyncRef.current = true;
    translateStartGeomsRef.current.clear();
    linkedLineDragRef.current = null;
    if (!editModeRef.current || selectModeRef.current !== 'box') return;
    const collection = select.getFeatures();
    const selectedLineIds = new Set<string>();
    collection.forEach((f) => {
      const parsed = readFeatureGeometry(f);
      if (!parsed) return;
      translateStartGeomsRef.current.set(parsed.sel.id, parsed);
      if (parsed.coords && parsed.coords.length >= 2) selectedLineIds.add(parsed.sel.id);
    });

    const mergedLinks: LinkedLineDragState['links'] = [];
    collection.forEach((f) => {
      const members = f.get('features') as Feature[] | undefined;
      const inner = members?.length === 1 ? members[0] : f;
      const id = inner.get('id') as string | undefined;
      const kind = inner.get('featureKind') as string | undefined;
      const geom = f.getGeometry();
      if (!id || kind !== 'infra' || !(geom instanceof Point)) return;
      const pointObj = infraObjectsRef.current.find((o) => o.id === id);
      const [pointLon, pointLat] = pointObj
        ? [pointObj.lon, pointObj.lat]
        : transform(geom.getCoordinates(), 'EPSG:3857', 'EPSG:4326');
      mergedLinks.push(
        ...collectLinkedLinesForInfraMapPoint(
          lineSourceRef.current,
          id,
          pointLon,
          pointLat,
          infraObjectsRef.current,
          selectedLineIds,
        ),
      );
    });
    if (mergedLinks.length > 0) {
      linkedLineDragRef.current = { sessionId, links: mergedLinks };
    }
    void sessionId;
  });
}
