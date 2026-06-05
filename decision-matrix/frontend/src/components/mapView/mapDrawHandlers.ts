import { transform } from 'ol/proj';
import type { MapHitHelpers } from './mapHitHelpers';
import type { MapSetupContext } from './mapSetupContext';

const DOUBLE_RMB_MS = 650;
const DOUBLE_RMB_MAX_PX = 28;

export type MapDrawHandlers = {
  finishAtFromPointerEvent: (
    e: MouseEvent | PointerEvent,
  ) => {
    lon: number;
    lat: number;
    id?: string;
    splitHint?: { lineId: string; segmentIndex: number; snapLon: number; snapLat: number };
  } | null;
  tryFinishLineAtPointer: (e: MouseEvent | PointerEvent) => boolean;
  onLineContextMenu: (e: MouseEvent) => void;
  onLinePointerDown: (e: PointerEvent) => void;
};

export function createMapDrawHandlers(
  ctx: MapSetupContext,
  hitHelpers: MapHitHelpers,
): MapDrawHandlers {
  const { refs, interactions } = ctx;
  const { map } = interactions;
  const {
    drawModeRef,
    draftLineRef,
    onFinishLineRef,
    suppressMapClickRef,
    lineRightClickRef,
  } = refs;
  const { resolveInfraPointAtPixel, resolveInfraLineSplitAtPixel } = hitHelpers;

  const finishAtFromPointerEvent = (
    e: MouseEvent | PointerEvent,
  ): {
    lon: number;
    lat: number;
    id?: string;
    splitHint?: { lineId: string; segmentIndex: number; snapLon: number; snapLat: number };
  } | null => {
    const pixel = map.getEventPixel(e as UIEvent);
    const hit = resolveInfraPointAtPixel(pixel);
    if (hit) return { lon: hit.lon, lat: hit.lat, id: hit.id };
    const overLine = resolveInfraLineSplitAtPixel(pixel);
    if (overLine) {
      return {
        lon: overLine.lon,
        lat: overLine.lat,
        splitHint: {
          lineId: overLine.lineId,
          segmentIndex: overLine.segmentIndex,
          snapLon: overLine.lon,
          snapLat: overLine.lat,
        },
      };
    }
    const mapCoord = map.getCoordinateFromPixel(pixel);
    if (!mapCoord) return null;
    const [lon, lat] = transform(mapCoord, 'EPSG:3857', 'EPSG:4326');
    return { lon, lat };
  };

  const tryFinishLineAtPointer = (e: MouseEvent | PointerEvent): boolean => {
    if (drawModeRef.current !== 'line') return false;
    const coords = draftLineRef.current || [];
    if (coords.length < 2) return false;
    const finishAt = finishAtFromPointerEvent(e);
    if (!finishAt) return false;
    const { lon, lat, id, splitHint } = finishAt;
    onFinishLineRef.current?.(coords, { lon, lat, id }, splitHint);
    return true;
  };

  const onLineContextMenu = (e: MouseEvent) => {
    if (drawModeRef.current !== 'line') return;
    e.preventDefault();
  };

  const onLinePointerDown = (e: PointerEvent) => {
    if (e.button !== 2) return;
    if (drawModeRef.current !== 'line') return;
    e.preventDefault();
    suppressMapClickRef.current = true;
    window.setTimeout(() => {
      suppressMapClickRef.current = false;
    }, 450);

    const now = Date.now();
    const prev = lineRightClickRef.current;
    const dist = Math.hypot(e.clientX - prev.x, e.clientY - prev.y);
    if (prev.at > 0 && now - prev.at <= DOUBLE_RMB_MS && dist <= DOUBLE_RMB_MAX_PX) {
      lineRightClickRef.current = { at: 0, x: 0, y: 0 };
      tryFinishLineAtPointer(e);
    } else {
      lineRightClickRef.current = { at: now, x: e.clientX, y: e.clientY };
    }
  };

  return {
    finishAtFromPointerEvent,
    tryFinishLineAtPointer,
    onLineContextMenu,
    onLinePointerDown,
  };
}
