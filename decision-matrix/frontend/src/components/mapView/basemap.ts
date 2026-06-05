import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
import type { Options as XyzOptions } from 'ol/source/XYZ';

/** Fast tile defaults: no fade-in; subdomains {a-d} for parallel HTTP/2 requests. */
export const XYZ_TILE_DEFAULTS: Pick<XyzOptions, 'crossOrigin' | 'transition' | 'maxZoom'> = {
  crossOrigin: 'anonymous',
  transition: 0,
  maxZoom: 19,
};

let esriBasemapSource: XYZ | null = null;

export function getEsriBasemapSource(): XYZ {
  if (!esriBasemapSource) {
    esriBasemapSource = new XYZ({
      ...XYZ_TILE_DEFAULTS,
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attributions: 'Tiles © Esri',
    });
  }
  return esriBasemapSource;
}

export function createBasemapLayer(): TileLayer {
  return new TileLayer({
    source: getEsriBasemapSource(),
    preload: 2,
    cacheSize: 512,
  });
}
