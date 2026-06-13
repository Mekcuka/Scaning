import { useEffect } from 'react';
import Feature from 'ol/Feature';
import LineString from 'ol/geom/LineString';
import Point from 'ol/geom/Point';
import Polygon from 'ol/geom/Polygon';
import { fromLonLat } from 'ol/proj';
import type { MapViewRefs } from './mapViewRefs';
import type { MapViewProps } from './types';

function coordsToGeometry(
  geometryType: string,
  coordinates: number[] | number[][] | number[][][],
) {
  if (geometryType === 'Point') {
    const c = coordinates as number[];
    return new Point(fromLonLat([c[0]!, c[1]!]));
  }
  if (geometryType === 'LineString') {
    const cs = coordinates as number[][];
    return new LineString(cs.map((c) => fromLonLat([c[0]!, c[1]!])));
  }
  if (geometryType === 'Polygon') {
    const rings = coordinates as number[][][];
    return new Polygon(rings.map((ring) => ring.map((c) => fromLonLat([c[0]!, c[1]!]))));
  }
  return null;
}

export function useMapViewPadPlacementSync(
  refs: MapViewRefs,
  features: MapViewProps['padPlacementPreviewFeatures'],
): void {
  useEffect(() => {
    if (refs.suppressDataSyncRef.current) return;
    const lines = refs.lineSourceRef.current;
    lines
      .getFeatures()
      .filter((f) => String(f.get('subtype') ?? '').startsWith('pad-placement-'))
      .forEach((f) => lines.removeFeature(f));

    (features ?? []).forEach((feat, i) => {
      const geom = coordsToGeometry(feat.geometryType, feat.coordinates);
      if (!geom) return;
      lines.addFeature(
        new Feature({
          geometry: geom,
          subtype: `pad-placement-${feat.kind}`,
          id: `pad-placement-${feat.kind}-${i}`,
        }),
      );
    });
    refs.lineLayerRef.current?.changed();
  }, [features, refs]);
}
