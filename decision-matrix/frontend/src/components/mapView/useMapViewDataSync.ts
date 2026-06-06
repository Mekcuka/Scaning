import { useEffect } from 'react';
import LineString from 'ol/geom/LineString';
import Point from 'ol/geom/Point';
import { fromLonLat } from 'ol/proj';
import { normalizeInfraSubtype } from '../../lib/api';
import type { LinePathDisplayOptions } from '../../lib/infraGeometry';
import { lineLodForScale } from '../../lib/mapLineLod';
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
  }: Pick<MapViewProps, 'pois' | 'infraObjects' | 'infraSnapPool' | 'lineLodScaleThreshold'>,
): void {
  const {
    syncInfraDataToLayersRef,
    pointSourceRef,
    nodePointSourceRef,
    lineSourceRef,
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
      lineLayerRef.current?.changed();
      nodePointLayerRef.current?.changed();
      pointLayerRef.current?.changed();
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
}
