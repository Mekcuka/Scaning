import type { ExpressionSpecification, Map as MapLibreMap } from 'maplibre-gl';
import { iconDataUrl } from '../mapIcons';
import { MAP3D_ICON_PREFIX } from './map3dConfig';

const loadedOnMap = new WeakMap<MapLibreMap, Set<string>>();

function imageId(subtype: string): string {
  return `${MAP3D_ICON_PREFIX}${subtype}`;
}

function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** Register subtype icons on the map (cached per map instance). */
export async function registerMap3dSubtypeIcons(
  map: MapLibreMap,
  subtypes: string[],
): Promise<void> {
  let set = loadedOnMap.get(map);
  if (!set) {
    set = new Set();
    loadedOnMap.set(map, set);
  }
  const unique = [...new Set(subtypes.filter(Boolean))];
  await Promise.all(
    unique.map(async (subtype) => {
      const id = imageId(subtype);
      if (set!.has(id) || map.hasImage(id)) {
        set!.add(id);
        return;
      }
      try {
        const img = await loadImageFromUrl(iconDataUrl(subtype));
        if (!map.hasImage(id)) {
          map.addImage(id, img, { pixelRatio: 2 });
        }
        set!.add(id);
      } catch {
        /* skip broken icon */
      }
    }),
  );
}

export function map3dIconImageExpression(): ExpressionSpecification {
  return ['concat', MAP3D_ICON_PREFIX, ['get', 'subtype']];
}

export function collectSubtypesFromGeoJson(
  infraObjects: { subtype: string }[],
  pois: { id: string }[],
): string[] {
  const subtypes = infraObjects.map((o) => o.subtype);
  if (pois.length) subtypes.push('poi');
  return subtypes;
}
