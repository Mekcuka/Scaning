import { memo } from 'react';
import 'ol/ol.css';
import { useMapViewInit } from './mapView/useMapViewInit';
import { useMapViewReactiveEffects } from './mapView/useMapViewReactiveEffects';
import { useMapViewRefs } from './mapView/useMapViewRefs';
import { useMapViewSnapIndex } from './mapView/useMapViewSnapIndex';
import type { MapViewProps } from './mapView/types';

export type {
  DrawMode,
  MapClickHit,
  MapFeatureSelection,
  MapFocusTarget,
  MapViewProps,
  MeasureLabel,
  SelectMode,
  ThresholdCircle,
} from './mapView/types';

function MapViewInner({
  pois = [],
  infraObjects = [],
  infraSnapPool,
  showBasemap = true,
  height = '100%',
  selectedFeatureId = null,
  ...rest
}: MapViewProps) {
  const props: MapViewProps = {
    pois,
    infraObjects,
    infraSnapPool,
    showBasemap,
    height,
    selectedFeatureId,
    ...rest,
  };

  const refs = useMapViewRefs(props);
  useMapViewSnapIndex(refs, infraSnapPool, infraObjects);
  useMapViewInit(refs, showBasemap ?? true);
  useMapViewReactiveEffects(refs, props);

  return (
    <div
      ref={refs.containerRef}
      className="map-container"
      style={{
        height,
        background: showBasemap ? undefined : 'var(--bg, #e8ecef)',
      }}
      data-selected={selectedFeatureId || ''}
    />
  );
}

export const MapView = memo(MapViewInner);
