import type OlMap from 'ol/Map';
import Feature from 'ol/Feature';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { transform } from 'ol/proj';
import { linkCoordMatch } from '../../lib/infraLinks';
import type { MapFeatureSelection } from './types';

export function resolveFeatureSelection(f: Feature): MapFeatureSelection | null {
  const features = f.get('features') as Feature[] | undefined;
  if (features && features.length > 1) {
    return null;
  }
  const inner = features?.length === 1 ? features[0] : f;
  const kind = inner.get('featureKind') as string;
  const id = inner.get('id') as string;
  const subtype = inner.get('subtype') as string;
  if (!id || subtype === 'draft') return null;
  if (kind === 'poi') return { kind: 'poi', id };
  if (kind === 'infra') return { kind: 'infra', id };
  return null;
}

export function expandLayerFeatures(f: Feature): Feature[] {
  const features = f.get('features') as Feature[] | undefined;
  if (features && features.length > 1) {
    return features.filter((inner) => {
      const subtype = inner.get('subtype') as string;
      return subtype !== 'draft' && !!inner.get('id');
    });
  }
  return [f];
}

/** Выбор по пикселю — учитывает отрисованную область иконки (OL hit-test). */
export function resolveSelectableFeatureAtPixel(
  map: OlMap,
  pixel: number[],
  layers: VectorLayer[],
  hitTolerancePx: number,
): Feature | undefined {
  const layerSet = new Set(layers);
  let found: Feature | undefined;
  map.forEachFeatureAtPixel(
    pixel,
    (feature, layer) => {
      if (!layerSet.has(layer as VectorLayer)) return false;
      if (!resolveFeatureSelection(feature as Feature)) return false;
      found = feature as Feature;
      return true;
    },
    {
      hitTolerance: hitTolerancePx,
      layerFilter: (layer) => layerSet.has(layer as VectorLayer),
    },
  );
  return found;
}

export function findSelectableLayerFeature(
  pointSource: VectorSource<Feature>,
  lineSource: VectorSource<Feature>,
  id: string,
  nodePointSource?: VectorSource<Feature>,
): Feature | undefined {
  for (const source of [pointSource, nodePointSource, lineSource]) {
    if (!source) continue;
    const found = source.getFeatures().find((f) => {
      if (f.get('subtype') === 'draft' || f.get('subtype') === 'measure') return false;
      if (f.get('id') === id) return true;
      return expandLayerFeatures(f).some((inner) => inner.get('id') === id);
    });
    if (found) return found;
  }
  return undefined;
}

export function lineEndMatchesStoredPoint(
  end3857: number[],
  pointLon: number,
  pointLat: number,
): boolean {
  const [lon, lat] = transform(end3857, 'EPSG:3857', 'EPSG:4326');
  return linkCoordMatch(lon, pointLon) && linkCoordMatch(lat, pointLat);
}
