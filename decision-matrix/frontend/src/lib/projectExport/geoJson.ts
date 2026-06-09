import type { Feature, FeatureCollection, LineString, Point } from 'geojson';
import type { InfraObject } from '../api';
import { getLineCoordinates, isLineSubtype } from '../infraGeometry';
import { downloadBlob } from '../mapSnapshot';

function featureProperties(obj: InfraObject): Record<string, unknown> {
  return {
    name: obj.name,
    subtype: obj.subtype,
    ...(obj.properties ?? {}),
  };
}

export function buildProjectGeoJson(objects: InfraObject[]): FeatureCollection {
  const features: Feature[] = [];

  for (const obj of objects) {
    if (isLineSubtype(obj.subtype)) {
      const coords = getLineCoordinates(obj);
      if (!coords || coords.length < 2) continue;
      features.push({
        type: 'Feature',
        properties: featureProperties(obj),
        geometry: {
          type: 'LineString',
          coordinates: coords,
        },
      } satisfies Feature<LineString>);
      continue;
    }

    features.push({
      type: 'Feature',
      properties: featureProperties(obj),
      geometry: {
        type: 'Point',
        coordinates: [obj.lon, obj.lat],
      },
    } satisfies Feature<Point>);
  }

  return { type: 'FeatureCollection', features };
}

export function downloadProjectGeoJson(filename: string, objects: InfraObject[]): void {
  const geojson = buildProjectGeoJson(objects);
  const blob = new Blob([JSON.stringify(geojson, null, 2)], {
    type: 'application/geo+json;charset=utf-8',
  });
  downloadBlob(blob, filename);
}
