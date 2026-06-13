import VectorLayer from 'ol/layer/Vector';
import type { FeatureLike } from 'ol/Feature';
import Point from 'ol/geom/Point';
import LineString from 'ol/geom/LineString';
import { Circle as CircleStyle, Fill, Stroke, Style, Text } from 'ol/style';
import { MAP_SUBTYPE_COLORS } from '../../lib/mapIcons';
import { isEarthworkEligibleSubtype } from '../../lib/infraPadEarthwork';
import { LINE_SUBTYPE_SET, MAP_LAYER_Z, MAP_VECTOR_RENDER_BUFFER } from './constants';
import { createBasemapLayer } from './basemap';
import type { MapLayers } from './mapSetupContext';
import type { MapViewRefs } from './mapViewRefs';
import {
  layerColorMap,
  layerOpacityMap,
  lineStrokeStyles,
  lineStyleForStatus,
  placementPreviewStyles,
  pointFeatureStyles,
  footprintModePointHitStyle,
  padFootprintFeatureStyles,
} from './styles';

function createInfraPointLayerStyle(refs: MapViewRefs) {
  const { layersRef, hoveredIdRef, useIconsRef, infraSymbologyRef } = refs;
  return (feature: FeatureLike) => {
    const subtype = feature.get('subtype') as string;
    const id = feature.get('id') as string;
    const layerId = feature.get('layer_id') as string | undefined;
    const opacityByLayer = layerOpacityMap(layersRef.current);
    const op = layerId ? opacityByLayer[layerId] ?? 1 : 1;
    const scale = op < 0.5 ? 0.85 : 1;
    if (op <= 0) return new Style({});
    const hovered = !!id && hoveredIdRef.current === id;
    if (
      infraSymbologyRef.current === 'footprints' &&
      isEarthworkEligibleSubtype(subtype)
    ) {
      return footprintModePointHitStyle(hovered);
    }
    return pointFeatureStyles(subtype, scale, hovered, useIconsRef.current);
  };
}

function createPadFootprintLayerStyle(refs: MapViewRefs) {
  const { layersRef, hoveredIdRef, infraSymbologyRef } = refs;
  return (feature: FeatureLike) => {
    if (infraSymbologyRef.current !== 'footprints') return new Style({});
    const subtype = feature.get('subtype') as string;
    const id = feature.get('id') as string;
    const layerId = feature.get('layer_id') as string | undefined;
    const opacityByLayer = layerOpacityMap(layersRef.current);
    const op = layerId ? opacityByLayer[layerId] ?? 1 : 1;
    const hovered = !!id && hoveredIdRef.current === id;
    return padFootprintFeatureStyles(subtype, hovered, op);
  };
}

export function createMapLayers(refs: MapViewRefs, showBasemap: boolean): MapLayers {
  const {
    layersRef,
    pointSourceRef,
    nodePointSourceRef,
    lineSourceRef,
    radiusSourceRef,
    placementPreviewSourceRef,
    connectionSourceRef,
    padFootprintSourceRef,
    pointLayerRef,
    padFootprintLayerRef,
    nodePointLayerRef,
    lineLayerRef,
    basemapLayerRef,
    hoveredIdRef,
    useIconsRef,
  } = refs;

  const pointStyle = createInfraPointLayerStyle(refs);
  const footprintStyle = createPadFootprintLayerStyle(refs);

  const padFootprintLayer = new VectorLayer({
    source: padFootprintSourceRef.current,
    zIndex: MAP_LAYER_Z.footprint,
    renderBuffer: MAP_VECTOR_RENDER_BUFFER,
    updateWhileAnimating: false,
    updateWhileInteracting: false,
    style: footprintStyle,
  });
  padFootprintLayerRef.current = padFootprintLayer;

  const lineLayer = new VectorLayer({
    source: lineSourceRef.current,
    zIndex: MAP_LAYER_Z.line,
    renderBuffer: MAP_VECTOR_RENDER_BUFFER,
    updateWhileAnimating: false,
    updateWhileInteracting: false,
    style: (feature) => {
      const subtype = feature.get('subtype') as string;
      if (subtype === 'draft') {
        return new Style({
          stroke: new Stroke({ color: '#2196f3', width: 2.5 }),
        });
      }
      if (subtype === 'draft-preview') {
        return new Style({
          stroke: new Stroke({ color: '#2196f3', width: 2, lineDash: [8, 6] }),
        });
      }
      if (subtype === 'draft-point') {
        return new Style({
          image: new CircleStyle({
            radius: 7,
            fill: new Fill({ color: '#2196f3' }),
            stroke: new Stroke({ color: '#fff', width: 2 }),
          }),
        });
      }
      if (subtype === 'measure') {
        return new Style({
          stroke: new Stroke({ color: '#c45c00', width: 2.5, lineDash: [8, 6] }),
        });
      }
      if (subtype === 'autoroad-plan-link') {
        return new Style({
          stroke: new Stroke({ color: '#7b1fa2', width: 3, lineDash: [10, 6] }),
        });
      }
      if (subtype === 'autoroad-plan-connector') {
        return new Style({
          stroke: new Stroke({ color: '#e65100', width: 2.5, lineDash: [6, 6] }),
        });
      }
      if (subtype === 'footprint-edge-highlight') {
        return new Style({
          stroke: new Stroke({ color: '#ff9800', width: 5 }),
        });
      }
      const id = feature.get('id') as string;
      const hovered = id && hoveredIdRef.current === id;
      const layerId = feature.get('layer_id') as string | undefined;
      const opacityByLayer = layerOpacityMap(layersRef.current);
      const colorByLayer = layerColorMap(layersRef.current);
      const op = layerId ? opacityByLayer[layerId] ?? 1 : 1;
      const custom = layerId ? colorByLayer[layerId] : undefined;
      const color = LINE_SUBTYPE_SET.has(subtype)
        ? (MAP_SUBTYPE_COLORS[subtype] || '#666')
        : (custom || MAP_SUBTYPE_COLORS[subtype] || '#666');
      const strokeColor =
        op < 1 && color.startsWith('#')
          ? `${color}${Math.round(op * 255)
              .toString(16)
              .padStart(2, '0')}`
          : color;
      return lineStrokeStyles(strokeColor, 3, !!hovered);
    },
  });

  const nodePointLayer = new VectorLayer({
    source: nodePointSourceRef.current,
    zIndex: MAP_LAYER_Z.nodePoint,
    renderBuffer: MAP_VECTOR_RENDER_BUFFER,
    updateWhileAnimating: false,
    updateWhileInteracting: false,
    style: pointStyle,
  });

  const pointLayer = new VectorLayer({
    source: pointSourceRef.current,
    zIndex: MAP_LAYER_Z.point,
    renderBuffer: MAP_VECTOR_RENDER_BUFFER,
    updateWhileAnimating: false,
    updateWhileInteracting: false,
    style: pointStyle,
  });
  pointLayerRef.current = pointLayer;
  nodePointLayerRef.current = nodePointLayer;
  lineLayerRef.current = lineLayer;

  const radiusLayer = new VectorLayer({
    source: radiusSourceRef.current,
    zIndex: MAP_LAYER_Z.radius,
    style: (feature) => {
      const color = (feature.get('color') as string) || '#999';
      return new Style({
        fill: new Fill({ color: color + '26' }),
        stroke: new Stroke({ color, width: 1, lineDash: [4, 4] }),
      });
    },
  });

  const placementPreviewLayer = new VectorLayer({
    source: placementPreviewSourceRef.current,
    zIndex: MAP_LAYER_Z.placementPreview,
    style: (feature) =>
      placementPreviewStyles(feature.get('subtype') as string, useIconsRef.current),
  });

  const connectionLayer = new VectorLayer({
    source: connectionSourceRef.current,
    zIndex: MAP_LAYER_Z.connection,
    style: (feature) => {
      const base = lineStyleForStatus(feature.get('status') as string);
      const dist = feature.get('distance_km') as number | null | undefined;
      if (dist == null) return base;
      const geom = feature.getGeometry();
      if (!(geom instanceof LineString)) return base;
      const mid = geom.getCoordinateAt(0.5);
      return [
        base,
        new Style({
          geometry: new Point(mid),
          text: new Text({
            text: `${Number(dist).toFixed(1)} км`,
            font: '11px system-ui,sans-serif',
            fill: new Fill({ color: '#212121' }),
            stroke: new Stroke({ color: '#ffffff', width: 3 }),
            offsetY: -10,
          }),
        }),
      ];
    },
  });

  const basemapLayer = createBasemapLayer();
  basemapLayer.setVisible(showBasemap);
  basemapLayerRef.current = basemapLayer;

  return {
    lineLayer,
    nodePointLayer,
    pointLayer,
    padFootprintLayer,
    radiusLayer,
    placementPreviewLayer,
    connectionLayer,
    basemapLayer,
  };
}
