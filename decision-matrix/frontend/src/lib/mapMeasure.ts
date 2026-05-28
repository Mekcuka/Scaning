import { LineString } from 'ol/geom';
import { fromLonLat } from 'ol/proj';
import { getLength } from 'ol/sphere';

/** Geodesic length of a lon/lat polyline in meters. */
export function lineLengthMeters(coords: number[][]): number {
  if (coords.length < 2) return 0;
  const geom = new LineString(coords.map(([lon, lat]) => fromLonLat([lon, lat])));
  return getLength(geom, { projection: 'EPSG:3857' });
}

export function formatLengthMeters(meters: number): string {
  if (!Number.isFinite(meters) || meters <= 0) return '0 м';
  if (meters >= 1000) {
    const km = meters / 1000;
    return km >= 10 ? `${km.toFixed(1)} км` : `${km.toFixed(2)} км`;
  }
  return `${Math.round(meters)} м`;
}
