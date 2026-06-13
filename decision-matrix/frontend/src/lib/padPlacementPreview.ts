import type { PadPlacementGeoJson } from './padPlacementTypes';

export type PadPlacementPreviewFeature = {
  coordinates: number[] | number[][] | number[][][];
  geometryType: string;
  kind: string;
  candidateId?: string;
};

export function geoJsonToPreviewFeatures(
  geo: PadPlacementGeoJson | undefined,
): PadPlacementPreviewFeature[] {
  if (!geo?.features?.length) return [];
  return geo.features.map((f) => ({
    coordinates: f.geometry.coordinates as number[] | number[][] | number[][][],
    geometryType: f.geometry.type,
    kind: String(f.properties?.kind ?? 'preview'),
    candidateId:
      typeof f.properties?.candidate_id === 'string' ? f.properties.candidate_id : undefined,
  }));
}
