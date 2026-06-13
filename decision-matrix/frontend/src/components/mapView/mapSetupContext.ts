import type OlMap from 'ol/Map';
import type TileLayer from 'ol/layer/Tile';
import type VectorLayer from 'ol/layer/Vector';
import type Select from 'ol/interaction/Select';
import type Modify from 'ol/interaction/Modify';
import type Translate from 'ol/interaction/Translate';
import type DragBox from 'ol/interaction/DragBox';
import type DragPan from 'ol/interaction/DragPan';
import type { MapViewRefs } from './mapViewRefs';

export type MapLayers = {
  lineLayer: VectorLayer;
  nodePointLayer: VectorLayer;
  pointLayer: VectorLayer;
  padFootprintLayer: VectorLayer;
  radiusLayer: VectorLayer;
  placementPreviewLayer: VectorLayer;
  connectionLayer: VectorLayer;
  basemapLayer: TileLayer;
};

export type MapInteractions = {
  map: OlMap;
  select: Select;
  modify: Modify;
  translate: Translate;
  dragBox: DragBox;
  dragPan: DragPan | null;
};

export type MapSetupContext = {
  refs: MapViewRefs;
  layers: MapLayers;
  interactions: MapInteractions;
};
