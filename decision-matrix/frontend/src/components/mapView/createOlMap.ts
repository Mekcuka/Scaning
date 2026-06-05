import OlMap from 'ol/Map';
import View from 'ol/View';
import { fromLonLat } from 'ol/proj';
import { defaults as defaultInteractions } from 'ol/interaction/defaults';
import { resolveInitialMapView } from '../../lib/mapViewState';
import type { MapLayers } from './mapSetupContext';
import type { MapViewRefs } from './mapViewRefs';

export function createOlMap(refs: MapViewRefs, layers: MapLayers): OlMap {
  const { containerRef, viewStateIdRef, projectIdRef, viewStateScopeRef } = refs;
  const {
    basemapLayer,
    radiusLayer,
    connectionLayer,
    lineLayer,
    pointLayer,
    placementPreviewLayer,
  } = layers;

  return new OlMap({
    target: containerRef.current!,
    layers: [
      basemapLayer,
      radiusLayer,
      connectionLayer,
      lineLayer,
      pointLayer,
      placementPreviewLayer,
    ],
    interactions: defaultInteractions({ doubleClickZoom: false }),
    view: (() => {
      const initial = resolveInitialMapView(
        viewStateIdRef.current,
        projectIdRef.current ?? null,
        viewStateScopeRef.current
      );
      return new View({
        center: fromLonLat([initial.centerLon, initial.centerLat]),
        zoom: initial.zoom,
      });
    })(),
  });
}
