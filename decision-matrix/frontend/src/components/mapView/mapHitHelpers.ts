import type OlMap from 'ol/Map';
import {
  resolveInfraLineSplitAtCoordinate,
  resolveInfraPointAtCoordinate,
} from '../../lib/mapHitTest';
import type { MapClickHit } from './types';
import type { MapViewRefs } from './mapViewRefs';

export type MapHitHelpers = {
  resolveInfraPointAtPixel: (pixel: number[]) => ReturnType<typeof resolveInfraPointAtCoordinate>;
  resolveInfraLineSplitAtPixel: (pixel: number[]) => MapClickHit['overLine'] | null;
};

export function createMapHitHelpers(map: OlMap, refs: MapViewRefs): MapHitHelpers {
  const { pointSourceRef, lineSourceRef } = refs;

  const resolveInfraPointAtPixel = (pixel: number[]) => {
    const coordinate = map.getCoordinateFromPixel(pixel);
    if (!coordinate) return null;
    return resolveInfraPointAtCoordinate(map, pointSourceRef.current, coordinate, 20);
  };

  const resolveInfraLineSplitAtPixel = (pixel: number[]): MapClickHit['overLine'] | null => {
    const coordinate = map.getCoordinateFromPixel(pixel);
    if (!coordinate) return null;
    return resolveInfraLineSplitAtCoordinate(
      map,
      lineSourceRef.current,
      coordinate,
      pixel,
      16,
    );
  };

  return { resolveInfraPointAtPixel, resolveInfraLineSplitAtPixel };
}
