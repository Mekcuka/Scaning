import { useEffect } from 'react';
import LineString from 'ol/geom/LineString';
import Point from 'ol/geom/Point';
import Polygon from 'ol/geom/Polygon';
import { fromLonLat } from 'ol/proj';
import { normalizeInfraSubtype } from '../../lib/api';
import type { LinePathDisplayOptions } from '../../lib/infraGeometry';
import { lineLodForScale } from '../../lib/mapLineLod';
import { resolveFootprintLonLat } from '../../lib/padFootprintGeo';
import { isMapNodePointSubtype, SYNC_IDLE_INFRA_THRESHOLD, SYNC_IDLE_TIMEOUT_MS } from './constants';
import { infraLineGeometry, syncFeaturesById } from './geometry';
import type { MapViewRefs } from './mapViewRefs';
import type { MapViewProps } from './types';

export function useMapViewDataSync(
  refs: MapViewRefs,
  {
    pois = [],
    infraObjects = [],
    infraSnapPool,
    lineLodScaleThreshold,
    infraSymbology = 'points',
  }: Pick<
    MapViewProps,
    'pois' | 'infraObjects' | 'infraSnapPool' | 'lineLodScaleThreshold' | 'infraSymbology'
  >,
): void {
  const {
    syncInfraDataToLayersRef,
    pointSourceRef,
    nodePointSourceRef,
    lineSourceRef,
    padFootprintSourceRef,
    infraSnapPoolRef,
    infraObjectsRef,
    poisRef,
    mapScaleDenominatorRef,
    lineLodScaleThresholdRef,
    lineLodRef,
    snapIndexRef,
    lineLayerRef,
    nodePointLayerRef,
    pointLayerRef,
    padFootprintLayerRef,
    infraSymbologyRef,
    infraIdsRef,
    editModeRef,
    suppressDataSyncRef,
  } = refs;

  useEffect(() => {
    syncInfraDataToLayersRef.current = () => {
      const points = pointSourceRef.current;
      const nodePoints = nodePointSourceRef.current;
      const lines = lineSourceRef.current;
      const snapPool = infraSnapPoolRef.current ?? infraObjectsRef.current;
      const infra = infraObjectsRef.current;
      const poisList = poisRef.current;
      const lineLod = lineLodForScale(
        mapScaleDenominatorRef.current,
        lineLodScaleThresholdRef.current,
      );
      lineLodRef.current = lineLod;
      const lineDisplayOpts: LinePathDisplayOptions = {
        snapIndex: snapIndexRef.current ?? undefined,
        lod: lineLod,
        infraSymbology: infraSymbologyRef.current,
      };

      const lineItems: { id: string; geometry: LineString; attrs: Record<string, unknown> }[] = [];
      const pointItems: { id: string; geometry: Point; attrs: Record<string, unknown> }[] = [];

      infra.forEach((obj) => {
        const lineGeom = infraLineGeometry(obj, snapPool, lineDisplayOpts);
        const attrs = {
          name: obj.name,
          subtype: normalizeInfraSubtype(obj.subtype),
          layer_id: obj.layer_id,
          featureKind: 'infra',
        };
        if (lineGeom) {
          lineItems.push({ id: obj.id, geometry: lineGeom, attrs });
        } else {
          pointItems.push({
            id: obj.id,
            geometry: new Point(fromLonLat([obj.lon, obj.lat])),
            attrs,
          });
        }
      });

      poisList.forEach((poi) => {
        pointItems.push({
          id: poi.id,
          geometry: new Point(fromLonLat([poi.lon, poi.lat])),
          attrs: { name: poi.name, subtype: 'poi', featureKind: 'poi' },
        });
      });

      const nodePointItems: typeof pointItems = [];
      const regularPointItems: typeof pointItems = [];
      for (const item of pointItems) {
        if (isMapNodePointSubtype(String(item.attrs.subtype))) {
          nodePointItems.push(item);
        } else {
          regularPointItems.push(item);
        }
      }

      syncFeaturesById(lines, lineItems, 'draft');
      syncFeaturesById(nodePoints, nodePointItems);
      syncFeaturesById(points, regularPointItems);

      const footprints = padFootprintSourceRef.current;
      if (infraSymbologyRef.current === 'footprints') {
        const footprintItems: {
          id: string;
          geometry: Polygon;
          attrs: Record<string, unknown>;
        }[] = [];
        infra.forEach((obj) => {
          const ring = resolveFootprintLonLat(obj);
          if (!ring) return;
          const coords = ring.map(([lon, lat]) => fromLonLat([lon, lat]));
          footprintItems.push({
            id: obj.id,
            geometry: new Polygon([coords]),
            attrs: {
              name: obj.name,
              subtype: normalizeInfraSubtype(obj.subtype),
              layer_id: obj.layer_id,
              featureKind: 'infra',
              footprint: true,
            },
          });
        });
        syncFeaturesById(footprints, footprintItems);
      } else {
        footprints.clear();
      }

      lineLayerRef.current?.changed();
      nodePointLayerRef.current?.changed();
      pointLayerRef.current?.changed();
      padFootprintLayerRef.current?.changed();
    };

    const nextIds = new Set(infraObjects.map((o) => o.id));
    const prevIds = infraIdsRef.current;
    const hasNewInfra = [...nextIds].some((id) => !prevIds.has(id));
    const hasRemovedInfra = [...prevIds].some((id) => !nextIds.has(id));
    infraIdsRef.current = nextIds;
    if (hasNewInfra || hasRemovedInfra || (!editModeRef.current && suppressDataSyncRef.current)) {
      suppressDataSyncRef.current = false;
    }
    if (suppressDataSyncRef.current) return;
    const runSync = () => {
      if (!suppressDataSyncRef.current) syncInfraDataToLayersRef.current?.();
    };
    if (infraObjects.length >= SYNC_IDLE_INFRA_THRESHOLD) {
      if (typeof requestIdleCallback !== 'undefined') {
        const idleId = requestIdleCallback(runSync, { timeout: SYNC_IDLE_TIMEOUT_MS });
        return () => cancelIdleCallback(idleId);
      }
      const t = setTimeout(runSync, 0);
      return () => clearTimeout(t);
    }
    runSync();
  }, [pois, infraObjects, infraSnapPool]);

  useEffect(() => {
    const lineLod = lineLodForScale(
      mapScaleDenominatorRef.current,
      lineLodScaleThreshold ?? lineLodScaleThresholdRef.current,
    );
    if (lineLodRef.current === lineLod) return;
    lineLodRef.current = lineLod;
    syncInfraDataToLayersRef.current?.();
    lineLayerRef.current?.changed();
  }, [lineLodScaleThreshold]);

  useEffect(() => {
    infraSymbologyRef.current = infraSymbology;
    syncInfraDataToLayersRef.current?.();
    pointLayerRef.current?.changed();
    padFootprintLayerRef.current?.changed();
  }, [infraSymbology]);
}
