import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import LineString from 'ol/geom/LineString';
import { fromLonLat, transform } from 'ol/proj';
import type Modify from 'ol/interaction/Modify';
import { constrainLineCoordinatesOnEdit, normalizeLinePathEndpoints } from '../../../lib/lineEndpointRules';
import { useAppStore } from '../../../store';
import { lineCoordsFromGeometry } from '../geometry';
import type { MapHitHelpers } from '../mapHitHelpers';
import type { MapSetupContext } from '../mapSetupContext';
import { lineEndpointMoved } from './helpers';

export function bindModifyEndHandler(
  ctx: MapSetupContext,
  modify: Modify,
  hitHelpers: MapHitHelpers,
) {
  const { refs, interactions } = ctx;
  const { select } = interactions;
  const {
    infraObjectsRef,
    pointLayerRef,
    nodePointLayerRef,
    lineLayerRef,
    editModeRef,
    modifySessionRef,
    lineModifySessionRef,
    linkedLineDragRef,
    suppressDataSyncRef,
    syncInfraDataToLayersRef,
    onGeometryChangeRef,
  } = refs;
  const { resolveInfraPointAtPixel } = hitHelpers;

  modify.on('modifyend', (evt) => {
    const sessionId = modifySessionRef.current;
    const finishSession = () => {
      if (sessionId !== modifySessionRef.current) return;
      linkedLineDragRef.current = null;
      lineModifySessionRef.current = null;
      suppressDataSyncRef.current = false;
      syncInfraDataToLayersRef.current?.();
    };
    if (!editModeRef.current) {
      finishSession();
      return;
    }
    const f = select.getFeatures().item(0);
    if (!f) {
      finishSession();
      return;
    }
    const members = f.get('features') as Feature[] | undefined;
    const inner = members?.length === 1 ? members[0] : f;
    const kind = inner.get('featureKind') as string;
    const id = inner.get('id') as string;
    const geom = f.getGeometry();
    if (!geom || !kind || !id) {
      finishSession();
      return;
    }
    if (members?.length === 1 && inner !== f && geom instanceof Point) {
      inner.setGeometry(geom.clone());
      pointLayerRef.current?.changed();
      nodePointLayerRef.current?.changed();
    }
    let save: void | Promise<void>;
    if (geom instanceof Point) {
      const [lon, lat] = transform(geom.getCoordinates(), 'EPSG:3857', 'EPSG:4326');
      save = onGeometryChangeRef.current?.(
        kind === 'poi' ? { kind: 'poi', id } : { kind: 'infra', id },
        lon,
        lat,
      );
    } else if (geom instanceof LineString) {
      let coords = lineCoordsFromGeometry(geom);
      const session = lineModifySessionRef.current;
      if (session && session.lineId === id && session.sessionId === sessionId) {
        const pool = infraObjectsRef.current.filter((o) => o.id !== id);
        const pixel = evt.mapBrowserEvent?.pixel;
        const hit = pixel ? resolveInfraPointAtPixel(pixel) : null;
        const hitObject = hit ? (pool.find((o) => o.id === hit.id) ?? null) : null;
        const draftStart = coords[0] as [number, number];
        const draftFinish = coords[coords.length - 1] as [number, number];
        const startMoved = lineEndpointMoved(draftStart, session.originalStart);
        const finishMoved = lineEndpointMoved(draftFinish, session.originalFinish);
        const draftCoords = coords;
        const constrained = constrainLineCoordinatesOnEdit({
          lineSubtype: session.subtype,
          originalStart: session.originalStart,
          originalFinish: session.originalFinish,
          originalStartAttach: session.originalStartAttach,
          originalFinishAttach: session.originalFinishAttach,
          draftCoords,
          infraObjects: pool,
          cursorTargetStart: startMoved ? hitObject : null,
          cursorTargetFinish: finishMoved ? hitObject : null,
        });
        coords = constrained.coords;
        const coordsChanged =
          draftCoords.length !== coords.length ||
          draftCoords.some(
            (c, i) =>
              Math.abs(c[0]! - coords[i]![0]!) > 1e-9 ||
              Math.abs(c[1]! - coords[i]![1]!) > 1e-9,
          );
        if (coordsChanged) {
          const nextGeom = new LineString(coords.map((c) => fromLonLat([c[0], c[1]])));
          f.setGeometry(nextGeom);
          if (members?.length === 1 && inner !== f) {
            inner.setGeometry(nextGeom.clone());
          }
          lineLayerRef.current?.changed();
        }
        if (constrained.revertedStart || constrained.revertedFinish) {
          useAppStore.getState().pushToast(
            'info',
            'Конец линии возвращён к исходному точечному объекту — нельзя оставить его без привязки',
          );
        }

      }
      const [lon, lat] = coords[0]!;
      save = onGeometryChangeRef.current?.({ kind: 'infra', id }, lon, lat, coords);
    } else {
      finishSession();
      return;
    }
    if (save != null && typeof (save as Promise<void>).then === 'function') {
      (save as Promise<void>).finally(finishSession);
    } else {
      finishSession();
    }
  });
}
