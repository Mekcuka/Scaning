import type { InfraObject } from '../api';
import { isLineSubtype } from '../infraGeometry';

const CELL_DEG = 0.01;

function haversineKm(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const r = 6371.0;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function cellKey(lon: number, lat: number): string {
  const ix = Math.floor(lon / CELL_DEG);
  const iy = Math.floor(lat / CELL_DEG);
  return `${ix}:${iy}`;
}

/** Grid index for nearest point-object lookup (replaces O(n) scan per line endpoint). */
export class InfraPointSnapIndex {
  private readonly cells = new Map<string, InfraObject[]>();

  constructor(objects: readonly InfraObject[]) {
    for (const obj of objects) {
      if (isLineSubtype(obj.subtype)) continue;
      const key = cellKey(obj.lon, obj.lat);
      const bucket = this.cells.get(key);
      if (bucket) bucket.push(obj);
      else this.cells.set(key, [obj]);
    }
  }

  nearest(
    point: [number, number],
    maxDistanceKm: number,
  ): { object: InfraObject; distanceKm: number } | null {
    const [lon, lat] = point;
    const radius = Math.max(1, Math.ceil(maxDistanceKm / 111));
    const ix0 = Math.floor(lon / CELL_DEG) - radius;
    const iy0 = Math.floor(lat / CELL_DEG) - radius;
    let best: InfraObject | null = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (let dx = 0; dx <= radius * 2; dx++) {
      for (let dy = 0; dy <= radius * 2; dy++) {
        const bucket = this.cells.get(`${ix0 + dx}:${iy0 + dy}`);
        if (!bucket) continue;
        for (const obj of bucket) {
          const d = haversineKm(lon, lat, obj.lon, obj.lat);
          if (d < bestDist) {
            bestDist = d;
            best = obj;
          }
        }
      }
    }
    if (!best) return null;
    return { object: best, distanceKm: bestDist };
  }
}
