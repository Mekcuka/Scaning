import Feature from 'ol/Feature';
import LineString from 'ol/geom/LineString';
import { fromLonLat, transform } from 'ol/proj';
import { LINE_SUBTYPE_SET, MAP_POINT_HIT_TOLERANCE_PX } from './constants';
import { resolveFeatureSelection } from './featureSelection';
import {
  findLineVertexIndexAtPixel,
  lineCoordsFromGeometry,
} from './geometry';
import type { MapDrawHandlers } from './mapDrawHandlers';
import type { MapHitHelpers } from './mapHitHelpers';
import type { MapSetupContext } from './mapSetupContext';

export function setupMapClickHandlers(
  ctx: MapSetupContext,
  hitHelpers: MapHitHelpers,
  drawHandlers: MapDrawHandlers,
): void {
  const { refs, layers, interactions } = ctx;
  const { map, select } = interactions;
  const { pointLayer, nodePointLayer, lineLayer, padFootprintLayer } = layers;
  const {
    drawModeRef,
    pasteModeRef,
    selectModeRef,
    editModeRef,
    draftLineRef,
    suppressMapClickRef,
    suppressDataSyncRef,
    onMapClickRef,
    onFeatureGroupSelectRef,
    onFinishMeasureRef,
    onFinishLineRef,
    onGeometryChangeRef,
    infraSymbologyRef,
    pointSourceRef,
    nodePointSourceRef,
    lineSourceRef,
  } = refs;
  const { resolveInfraPointAtPixel, resolveInfraLineSplitAtPixel } = hitHelpers;
  const { tryFinishLineAtPointer } = drawHandlers;

  map.on('click', (evt) => {
    const orig = evt.originalEvent;
    if (orig instanceof MouseEvent && orig.button !== 0) return;
    if (suppressMapClickRef.current) return;
    const mode = drawModeRef.current;
    if (mode !== 'select') {
      const [lon, lat] = transform(evt.coordinate, 'EPSG:3857', 'EPSG:4326');
      const overLine =
        mode === 'point' ? resolveInfraLineSplitAtPixel(evt.pixel) ?? undefined : undefined;
      const overPoint =
        mode === 'line' ||
        mode === 'autoroad_network' ||
        (mode === 'point' && !overLine)
          ? resolveInfraPointAtPixel(evt.pixel) ?? undefined
          : undefined;
      onMapClickRef.current?.(lon, lat, {
        ...(overPoint ? { overPoint } : {}),
        ...(overLine ? { overLine } : {}),
      });
      return;
    }
    if (pasteModeRef.current) {
      const [lon, lat] = transform(evt.coordinate, 'EPSG:3857', 'EPSG:4326');
      onMapClickRef.current?.(lon, lat);
      return;
    }
    if (selectModeRef.current === 'box') {
      const footprintLayers =
        infraSymbologyRef.current === 'footprints' ? [padFootprintLayer] : [];
      const selectableLayers = [...footprintLayers, pointLayer, nodePointLayer, lineLayer];
      const hit = map.forEachFeatureAtPixel(
        evt.pixel,
        (feat, layer) => {
          if (!selectableLayers.includes(layer as typeof pointLayer)) return undefined;
          if (layer === padFootprintLayer) {
            const id = (feat as Feature).get('id') as string;
            if (!id) return undefined;
            return (
              pointSourceRef.current.getFeatures().find((f) => f.get('id') === id) ??
              nodePointSourceRef.current.getFeatures().find((f) => f.get('id') === id) ??
              feat
            );
          }
          return resolveFeatureSelection(feat as Feature) ? feat : undefined;
        },
        {
          hitTolerance: MAP_POINT_HIT_TOLERANCE_PX,
          layerFilter: (l) => selectableLayers.includes(l as typeof pointLayer),
        },
      );
      if (!hit) {
        select.getFeatures().clear();
        onFeatureGroupSelectRef.current?.([]);
      }
    }
  });

  const tryRemoveLineVertexAtPixel = (pixel: number[]): boolean => {
    if (drawModeRef.current !== 'select') return false;
    if (!editModeRef.current || selectModeRef.current !== 'single') return false;

    const collection = select.getFeatures();
    const f = collection.item(0);
    if (!f) return false;

    const members = f.get('features') as Feature[] | undefined;
    const inner = members?.length === 1 ? members[0] : f;
    const kind = inner.get('featureKind') as string;
    const id = inner.get('id') as string;
    const subtype = inner.get('subtype') as string;
    const geom = f.getGeometry();
    if (kind !== 'infra' || !id || !LINE_SUBTYPE_SET.has(subtype) || !(geom instanceof LineString)) {
      return false;
    }

    const vertexIndex = findLineVertexIndexAtPixel(map, geom, pixel);
    const coords = lineCoordsFromGeometry(geom);
    if (
      vertexIndex == null ||
      coords.length <= 2 ||
      vertexIndex === 0 ||
      vertexIndex === coords.length - 1
    ) {
      return false;
    }

    const nextCoords = coords.filter((_, i) => i !== vertexIndex);
    const nextGeom = new LineString(nextCoords.map((c) => fromLonLat([c[0], c[1]])));
    suppressDataSyncRef.current = true;
    f.setGeometry(nextGeom);
    if (members?.length === 1 && inner !== f) {
      inner.setGeometry(nextGeom.clone());
    }
    lineLayer.changed();

    const [lon, lat] = nextCoords[0]!;
    const save = onGeometryChangeRef.current?.({ kind: 'infra', id }, lon, lat, nextCoords);
    if (save != null && typeof (save as Promise<void>).then === 'function') {
      (save as Promise<void>).finally(() => {
        suppressDataSyncRef.current = false;
      });
    } else {
      suppressDataSyncRef.current = false;
    }
    return true;
  };

  map.on('dblclick', (evt) => {
    const mode = drawModeRef.current;
    const orig = evt.originalEvent;
    if (orig instanceof MouseEvent && orig.button !== 0) return;

    if (mode === 'ruler') {
      evt.preventDefault();
      onFinishMeasureRef.current?.();
      return;
    }
    if (mode === 'select' && tryRemoveLineVertexAtPixel(evt.pixel)) {
      evt.preventDefault();
      return;
    }
    if (mode !== 'line') return;
    if ((draftLineRef.current || []).length < 2) return;
    evt.preventDefault();
    if (orig instanceof MouseEvent) {
      tryFinishLineAtPointer(orig);
    } else {
      const coords = draftLineRef.current || [];
      if (coords.length < 2) return;
      const overLine = resolveInfraLineSplitAtPixel(evt.pixel);
      const [lon, lat] = overLine
        ? [overLine.lon, overLine.lat]
        : transform(evt.coordinate, 'EPSG:3857', 'EPSG:4326');
      onFinishLineRef.current?.(
        coords,
        { lon, lat },
        overLine
          ? {
              lineId: overLine.lineId,
              segmentIndex: overLine.segmentIndex,
              snapLon: overLine.lon,
              snapLat: overLine.lat,
            }
          : undefined,
      );
    }
  });
}
