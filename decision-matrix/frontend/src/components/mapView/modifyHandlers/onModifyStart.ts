import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import LineString from 'ol/geom/LineString';
import { transform } from 'ol/proj';
import type Modify from 'ol/interaction/Modify';
import { findLineEndpointAttachment } from '../../../lib/lineEndpointRules';
import { LINE_SUBTYPE_SET } from '../constants';
import { lineCoordsFromGeometry } from '../geometry';
import type { MapSetupContext } from '../mapSetupContext';
import { collectLinkedLinesForInfraMapPoint } from '../translateHandlers/collectLinkedLinesForPoint';

export function bindModifyStartHandler(ctx: MapSetupContext, modify: Modify) {
  const { refs, interactions } = ctx;
  const { select } = interactions;
  const {
    infraObjectsRef,
    lineSourceRef,
    editModeRef,
    modifySessionRef,
    lineModifySessionRef,
    linkedLineDragRef,
    suppressDataSyncRef,
  } = refs;

  modify.on('modifystart', () => {
    const sessionId = ++modifySessionRef.current;
    suppressDataSyncRef.current = true;
    linkedLineDragRef.current = null;
    lineModifySessionRef.current = null;
    if (!editModeRef.current) return;
    const f = select.getFeatures().item(0);
    if (!f) return;
    const members = f.get('features') as Feature[] | undefined;
    const inner = members?.length === 1 ? members[0] : f;
    const subtype = inner.get('subtype') as string;
    const kind = inner.get('featureKind') as string;
    const id = inner.get('id') as string;
    const geom = f.getGeometry();
    if (!id || kind !== 'infra') return;

    if (geom instanceof LineString && LINE_SUBTYPE_SET.has(subtype)) {
      const coords = lineCoordsFromGeometry(geom);
      if (coords.length < 2) return;
      const pool = infraObjectsRef.current.filter((o) => o.id !== id);
      const originalStart = coords[0] as [number, number];
      const originalFinish = coords[coords.length - 1] as [number, number];
      lineModifySessionRef.current = {
        sessionId,
        lineId: id,
        subtype,
        originalStart,
        originalFinish,
        originalStartAttach: findLineEndpointAttachment(subtype, 'start', originalStart, pool),
        originalFinishAttach: findLineEndpointAttachment(
          subtype,
          'finish',
          originalFinish,
          pool,
        ),
      };
      return;
    }

    if (!(geom instanceof Point)) return;
    const pointObj = infraObjectsRef.current.find((o) => o.id === id);
    const [pointLon, pointLat] = pointObj
      ? [pointObj.lon, pointObj.lat]
      : transform(geom.getCoordinates(), 'EPSG:3857', 'EPSG:4326');
    const links = collectLinkedLinesForInfraMapPoint(
      lineSourceRef.current,
      id,
      pointLon,
      pointLat,
      infraObjectsRef.current,
    );
    if (links.length > 0) {
      linkedLineDragRef.current = { sessionId, links };
    }
  });
}
