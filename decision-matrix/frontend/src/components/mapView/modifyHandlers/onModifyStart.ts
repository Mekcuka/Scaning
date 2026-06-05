import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import LineString from 'ol/geom/LineString';
import type Modify from 'ol/interaction/Modify';
import { LINE_SUBTYPES } from '../../../lib/api';
import { findLineEndpointAttachment } from '../../../lib/lineEndpointRules';
import { LINE_SUBTYPE_SET } from '../constants';
import { lineEndMatchesStoredPoint } from '../featureSelection';
import { lineCoordsFromGeometry } from '../geometry';
import type { LinkedLineDragState } from '../types';
import type { MapSetupContext } from '../mapSetupContext';

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
    if (!pointObj) return;
    const links: LinkedLineDragState['links'] = [];
    lineSourceRef.current.getFeatures().forEach((lineFeature) => {
      const lineId = lineFeature.get('id') as string | undefined;
      const lineSubtype = lineFeature.get('subtype') as string | undefined;
      if (!lineId || !lineSubtype || lineSubtype === 'draft' || lineSubtype === 'measure') return;
      if (!LINE_SUBTYPES.includes(lineSubtype as (typeof LINE_SUBTYPES)[number])) return;
      const lineGeom = lineFeature.getGeometry();
      if (!(lineGeom instanceof LineString)) return;
      const coords = lineGeom.getCoordinates();
      if (coords.length < 2) return;
      const first = coords[0]!;
      const last = coords[coords.length - 1]!;
      const start = lineEndMatchesStoredPoint(first, pointObj.lon, pointObj.lat);
      const end = lineEndMatchesStoredPoint(last, pointObj.lon, pointObj.lat);
      if (!start && !end) return;
      links.push({ lineId, start, end, pointId: id });
    });
    if (links.length > 0) {
      linkedLineDragRef.current = { sessionId, links };
    }
  });
}
