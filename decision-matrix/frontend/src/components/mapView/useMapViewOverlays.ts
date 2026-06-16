import { useEffect } from 'react';
import { boundingExtent } from 'ol/extent';
import Feature from 'ol/Feature';
import LineString from 'ol/geom/LineString';
import Point from 'ol/geom/Point';
import { circular as circularPolygon } from 'ol/geom/Polygon';
import Overlay from 'ol/Overlay';
import { fromLonLat } from 'ol/proj';
import { isValidAnalysisAnchor } from '../../lib/analysisDisplay';
import { resolveFootprintLonLat } from '../../lib/padFootprintGeo';
import { lonLatOnFootprintEdge } from '../../lib/padFootprintLineAttach';
import type { MapViewRefs } from './mapViewRefs';
import type { MapViewProps } from './types';

export function useMapViewOverlays(
  refs: MapViewRefs,
  {
    draftLine = [],
    draftLinePreview = null,
    measureLine = [],
    measurePreview = null,
    measureCompletedLines = [],
    measureCursorLabel = null,
    measureAnchorLabels = [],
    autoroadPlanPreviewLines = [],
    gsBottomholePreviewLines = [],
    connectionLines = [],
    selectedPoi = null,
    thresholdCircles = [],
    showRadii = true,
    placementPreview = null,
    placementPreviewPoints = [],
    clipboardPreviewPoints = [],
    clipboardPreviewLines = [],
    mapFocus = null,
    footprintEdgeHighlight = null,
    infraObjects = [],
  }: Pick<
    MapViewProps,
    | 'draftLine'
    | 'draftLinePreview'
    | 'measureLine'
    | 'measurePreview'
    | 'measureCompletedLines'
    | 'measureCursorLabel'
    | 'measureAnchorLabels'
    | 'autoroadPlanPreviewLines'
    | 'gsBottomholePreviewLines'
    | 'connectionLines'
    | 'selectedPoi'
    | 'thresholdCircles'
    | 'showRadii'
    | 'placementPreview'
    | 'placementPreviewPoints'
    | 'clipboardPreviewPoints'
    | 'clipboardPreviewLines'
    | 'mapFocus'
    | 'footprintEdgeHighlight'
    | 'infraObjects'
  >,
): void {
  const { mapRef, cursorMeasureOverlayRef, anchorMeasureOverlaysRef } = refs;

  useEffect(() => {
    if (refs.suppressDataSyncRef.current) return;
    const lines = refs.lineSourceRef.current;

    lines
      .getFeatures()
      .filter((f) =>
        f.get('subtype') === 'draft' ||
        f.get('subtype') === 'draft-preview' ||
        f.get('subtype') === 'draft-point' ||
        f.get('subtype') === 'autoroad-plan-link' ||
        f.get('subtype') === 'autoroad-plan-connector' ||
        f.get('subtype') === 'gs-bottomhole-connector-preview' ||
        f.get('subtype') === 'clipboard-preview-line' ||
        f.get('clipboardPreview') === true ||
        f.get('subtype') === 'footprint-edge-highlight'
      )
      .forEach((f) => lines.removeFeature(f));

    if (draftLine.length >= 2) {
      lines.addFeature(
        new Feature({
          geometry: new LineString(draftLine.map((c) => fromLonLat([c[0], c[1]]))),
          subtype: 'draft',
        }),
      );
    }

    if (draftLine.length >= 1 && draftLinePreview) {
      const last = draftLine[draftLine.length - 1]!;
      lines.addFeature(
        new Feature({
          geometry: new LineString([
            fromLonLat([last[0], last[1]]),
            fromLonLat([draftLinePreview[0], draftLinePreview[1]]),
          ]),
          subtype: 'draft-preview',
        }),
      );
    } else if (draftLine.length === 1) {
      const [lon, lat] = draftLine[0]!;
      lines.addFeature(
        new Feature({
          geometry: new Point(fromLonLat([lon, lat])),
          subtype: 'draft-point',
        }),
      );
    }

    lines
      .getFeatures()
      .filter((f) => f.get('subtype') === 'measure')
      .forEach((f) => lines.removeFeature(f));

    measureCompletedLines.forEach((coords, i) => {
      if (coords.length < 2) return;
      lines.addFeature(
        new Feature({
          geometry: new LineString(coords.map((c) => fromLonLat([c[0], c[1]]))),
          subtype: 'measure',
          id: `measure-done-${i}`,
          measureFinished: true,
        }),
      );
    });

    const activeCoords = [...measureLine];
    if (measurePreview && activeCoords.length >= 1) {
      activeCoords.push(measurePreview);
    }
    if (activeCoords.length >= 2) {
      lines.addFeature(
        new Feature({
          geometry: new LineString(activeCoords.map((c) => fromLonLat([c[0], c[1]]))),
          subtype: 'measure',
          id: 'measure-active',
          measureFinished: false,
        }),
      );
    }

    autoroadPlanPreviewLines.forEach((pl, i) => {
      if (pl.coordinates.length < 2) return;
      const subtype = pl.kind === 'connector' ? 'autoroad-plan-connector' : 'autoroad-plan-link';
      lines.addFeature(
        new Feature({
          geometry: new LineString(pl.coordinates.map((c) => fromLonLat([c[0], c[1]]))),
          subtype,
          id: `autoroad-plan-${i}`,
        }),
      );
    });

    gsBottomholePreviewLines.forEach((pl, i) => {
      if (pl.coordinates.length < 2) return;
      lines.addFeature(
        new Feature({
          geometry: new LineString(pl.coordinates.map((c) => fromLonLat([c[0], c[1]]))),
          subtype: 'gs-bottomhole-connector-preview',
          id: `gs-bottomhole-preview-${i}`,
        }),
      );
    });

    clipboardPreviewLines.forEach((pl, i) => {
      if (pl.coordinates.length < 2) return;
      lines.addFeature(
        new Feature({
          geometry: new LineString(pl.coordinates.map((c) => fromLonLat([c[0], c[1]]))),
          subtype:
            pl.subtype === 'well_bottomhole_gs'
              ? 'gs-bottomhole-connector-preview'
              : 'clipboard-preview-line',
          id: `clipboard-preview-line-${i}`,
          clipboardPreview: true,
        }),
      );
    });
  }, [
    draftLine,
    draftLinePreview,
    measureLine,
    measurePreview,
    measureCompletedLines,
    autoroadPlanPreviewLines,
    gsBottomholePreviewLines,
    clipboardPreviewLines,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const makeLabelEl = (className: string) => {
      const el = document.createElement('div');
      el.className = className;
      return el;
    };

    const mapOverlays = map.getOverlays().getArray();
    let cursorOverlay = cursorMeasureOverlayRef.current;
    if (cursorOverlay && !mapOverlays.includes(cursorOverlay)) {
      cursorMeasureOverlayRef.current = null;
      cursorOverlay = null;
    }

    if (!cursorOverlay) {
      const el = makeLabelEl('measure-label measure-label--cursor');
      const overlay = new Overlay({
        element: el,
        positioning: 'center-left',
        offset: [12, 0],
        stopEvent: false,
      });
      cursorMeasureOverlayRef.current = overlay;
      map.addOverlay(overlay);
      cursorOverlay = overlay;
    }

    const cursorEl = cursorOverlay.getElement();
    if (measureCursorLabel && cursorEl) {
      cursorEl.textContent = measureCursorLabel.text;
      cursorOverlay.setPosition(fromLonLat([measureCursorLabel.lon, measureCursorLabel.lat]));
    } else {
      cursorOverlay.setPosition(undefined);
    }

    anchorMeasureOverlaysRef.current = anchorMeasureOverlaysRef.current.filter((overlay) =>
      mapOverlays.includes(overlay),
    );

    while (anchorMeasureOverlaysRef.current.length > measureAnchorLabels.length) {
      const extra = anchorMeasureOverlaysRef.current.pop();
      if (extra) map.removeOverlay(extra);
    }
    while (anchorMeasureOverlaysRef.current.length < measureAnchorLabels.length) {
      const el = makeLabelEl('measure-label measure-label--anchor');
      const overlay = new Overlay({
        element: el,
        positioning: 'bottom-center',
        offset: [0, -10],
        stopEvent: false,
      });
      anchorMeasureOverlaysRef.current.push(overlay);
      map.addOverlay(overlay);
    }
    measureAnchorLabels.forEach((label, i) => {
      const overlay = anchorMeasureOverlaysRef.current[i];
      const el = overlay.getElement();
      if (!el) return;
      el.textContent = label.text;
      overlay.setPosition(fromLonLat([label.lon, label.lat]));
    });
  }, [measureCursorLabel, measureAnchorLabels]);

  useEffect(() => {
    const source = refs.connectionSourceRef.current;
    source.clear();
    if (!selectedPoi) return;
    const poiCoord = fromLonLat([selectedPoi.lon, selectedPoi.lat]);
    connectionLines.forEach((row) => {
      if (!isValidAnalysisAnchor(row.anchor_lon, row.anchor_lat)) return;
      source.addFeature(
        new Feature({
          geometry: new LineString([
            poiCoord,
            fromLonLat([row.anchor_lon!, row.anchor_lat!]),
          ]),
          status: row.status,
          subtype: row.subtype,
          distance_km: row.distance_km,
        }),
      );
    });
  }, [connectionLines, selectedPoi]);

  useEffect(() => {
    const source = refs.radiusSourceRef.current;
    source.clear();
    if (!showRadii || !selectedPoi) return;
    const centerLonLat: [number, number] = [selectedPoi.lon, selectedPoi.lat];
    thresholdCircles
      .filter((c) => c.visible && c.km > 0)
      .forEach((c) => {
        const geom = circularPolygon(centerLonLat, c.km * 1000, 128).transform(
          'EPSG:4326',
          'EPSG:3857',
        );
        source.addFeature(
          new Feature({
            geometry: geom,
            color: c.color,
            key: c.key,
          }),
        );
      });
  }, [thresholdCircles, selectedPoi, showRadii]);

  useEffect(() => {
    const source = refs.placementPreviewSourceRef.current;
    source.clear();
    if (placementPreview) {
      source.addFeature(
        new Feature({
          geometry: new Point(fromLonLat([placementPreview.lon, placementPreview.lat])),
          subtype: placementPreview.subtype,
        }),
      );
    }
    for (const pt of placementPreviewPoints) {
      source.addFeature(
        new Feature({
          geometry: new Point(fromLonLat([pt.lon, pt.lat])),
          subtype: pt.subtype,
        }),
      );
    }
    for (const pt of clipboardPreviewPoints) {
      source.addFeature(
        new Feature({
          geometry: new Point(fromLonLat([pt.lon, pt.lat])),
          subtype: pt.subtype,
          clipboardPreview: true,
        }),
      );
    }
  }, [placementPreview, placementPreviewPoints, clipboardPreviewPoints]);

  useEffect(() => {
    const map = refs.mapRef.current;
    if (!map || !mapFocus) return;
    const view = map.getView();
    if (mapFocus.extentLonLat) {
      const [minLon, minLat, maxLon, maxLat] = mapFocus.extentLonLat;
      const padLon = Math.max((maxLon - minLon) * 0.15, 0.008);
      const padLat = Math.max((maxLat - minLat) * 0.15, 0.008);
      const ext = boundingExtent([
        fromLonLat([minLon - padLon, minLat - padLat]),
        fromLonLat([maxLon + padLon, maxLat + padLat]),
      ]);
      view.fit(ext, { padding: [48, 48, 48, 48], maxZoom: 14, duration: 450 });
      return;
    }
    view.animate({
      center: fromLonLat([mapFocus.lon, mapFocus.lat]),
      zoom: Math.max(view.getZoom() ?? 9, 12),
      duration: 450,
    });
  }, [mapFocus?.nonce]);

  useEffect(() => {
    if (refs.suppressDataSyncRef.current) return;
    const lines = refs.lineSourceRef.current;
    lines
      .getFeatures()
      .filter((f) => f.get('subtype') === 'footprint-edge-highlight')
      .forEach((f) => lines.removeFeature(f));
    if (!footprintEdgeHighlight) return;
    const point = infraObjects.find((o) => o.id === footprintEdgeHighlight.pointId);
    const ring = point ? resolveFootprintLonLat(point) : null;
    if (!ring) return;
    const a = lonLatOnFootprintEdge(ring, footprintEdgeHighlight.edgeIndex, 0);
    const b = lonLatOnFootprintEdge(ring, footprintEdgeHighlight.edgeIndex, 1);
    if (!a || !b) return;
    lines.addFeature(
      new Feature({
        geometry: new LineString([fromLonLat(a), fromLonLat(b)]),
        subtype: 'footprint-edge-highlight',
      }),
    );
    refs.lineLayerRef.current?.changed();
  }, [footprintEdgeHighlight, infraObjects]);
}
