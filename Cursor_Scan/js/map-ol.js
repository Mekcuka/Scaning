/**
 * OpenLayers — карты СППР (FR-2.1, FR-9, FR-8.3.3)
 * MOCK.poi.coords: [lat, lon]
 */
const mapRegistry = new Map();

const BASEMAPS = {
  osm: {
    // CARTO надёжнее прямого OSM (политика тайлов, блокировки в части сетей)
    light: [
      "https://{a-d}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    ],
    dark: "https://{a-d}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attributions: "© Esri",
  },
  terrain: {
    url: "https://tile.opentopomap.org/{z}/{x}/{y}.png",
    attributions: "© OpenTopoMap",
  },
};

function createXyzSource(urlOrUrls, attributions) {
  const urls = Array.isArray(urlOrUrls) ? urlOrUrls : [urlOrUrls];
  const opts = {
    attributions: attributions || "",
    crossOrigin: "anonymous",
    maxZoom: 19,
  };
  if (urls.length > 1) opts.urls = urls;
  else opts.url = urls[0];
  return new ol.source.XYZ(opts);
}

const LINE_STATUS_COLORS = {
  within_limit: "#1b7a3d",
  exceeds_limit: "#b71c2a",
  construction_required: "#c45c00",
};

const LAYER_SUBTYPES = {
  roads: ["autoroad"],
  pipelines: ["oil_pipeline", "water_pipeline", "power_line"],
  areas: ["gas_processing", "gtes", "substation", "refinery"],
};

let mapDrawMode = "select";
let lineDrawFirstCoord = null;
let currentBasemapId = "osm";

function latLonToCoord(latLon) {
  return ol.proj.fromLonLat([latLon[1], latLon[0]]);
}

function infraToCoord(obj) {
  return ol.proj.fromLonLat([obj.lon, obj.lat]);
}

function getBasemapSource(basemapId) {
  if (basemapId === "osm") {
    const dark = document.documentElement.getAttribute("data-theme") === "dark";
    return createXyzSource(
      dark ? BASEMAPS.osm.dark : BASEMAPS.osm.light,
      "© OpenStreetMap © CARTO"
    );
  }
  if (basemapId === "satellite") {
    return createXyzSource(BASEMAPS.satellite.url, BASEMAPS.satellite.attributions);
  }
  if (basemapId === "terrain") {
    return createXyzSource(BASEMAPS.terrain.url, BASEMAPS.terrain.attributions);
  }
  return getBasemapSource("osm");
}

function getDefaultControls(isMini) {
  if (isMini) return [];
  return [new ol.control.Zoom(), new ol.control.Attribution({ collapsible: true })];
}

function olBootMainMap() {
  olDestroyMap("map-container");
  requestAnimationFrame(() => {
    olInitMap("map-container");
    requestAnimationFrame(() => {
      olScheduleMapResize("map-container");
      setTimeout(() => olScheduleMapResize("map-container"), 350);
    });
  });
}

function setMapStatus(message, isError = false) {
  const el = document.getElementById("map-status");
  if (!el) return;
  if (!message) {
    el.classList.add("hidden");
    el.textContent = "";
    return;
  }
  el.textContent = message;
  el.classList.toggle("map-status-error", isError);
  el.classList.remove("hidden");
}

function hexToRgba(hex, alpha) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

function circleStyle(color) {
  return new ol.style.Style({
    stroke: new ol.style.Stroke({ color, width: 1.5, lineDash: [4, 6] }),
    fill: new ol.style.Fill({ color: hexToRgba(color, 0.15) }),
  });
}

function lineStyle(color, dashed) {
  return new ol.style.Style({
    stroke: new ol.style.Stroke({
      color,
      width: 2.5,
      lineDash: dashed ? [10, 8] : undefined,
    }),
  });
}

function subtypeMatchesLayer(subtype, layerRef) {
  const list = LAYER_SUBTYPES[layerRef];
  return list ? list.includes(subtype) : false;
}

function createPoiElement() {
  const el = document.createElement("div");
  el.className = "poi-marker-wrap";
  el.innerHTML = '<div class="poi-marker-pulse"></div><div class="poi-marker-core"></div>';
  return el;
}

function createInfraElement(obj) {
  const meta = SUBTYPE_META[obj.subtype] || { icon: "map-pin", color: obj.color || "#666", label: obj.subtype };
  const el = document.createElement("div");
  el.className = "infra-marker-pin";
  el.style.background = meta.color;
  el.innerHTML = `<i data-lucide="${meta.icon}" class="infra-marker-icon"></i>`;
  el.title = obj.name;
  el.style.cursor = "pointer";
  return el;
}

function createPopupElement() {
  const el = document.createElement("div");
  el.className = "ol-map-popup";
  return el;
}

function updateMapScale(entry) {
  if (!entry || entry.isMini) return;
  const el = document.getElementById("map-scale");
  if (!el) return;
  const view = entry.map.getView();
  const resolution = view.getResolution();
  if (!resolution) return;
  const center = view.getCenter();
  const pointResolution = ol.proj.getPointResolution(view.getProjection(), resolution, center);
  const scale = Math.round(pointResolution * 39.37 * 72);
  el.textContent = scale > 0 ? `1:${scale.toLocaleString("ru-RU")}` : "—";
}

function buildRadiusFeatures(center) {
  return MOCK.radii.map((r) => {
    const km = r.km ?? parseInt(r.name.match(/\d+/)?.[0] || "50", 10);
    return new ol.Feature({
      geometry: new ol.geom.Circle(center, km * 1000),
      radiusId: r.id,
      radiusStyle: r.color,
      radiusVisible: r.checked !== false,
    });
  });
}

function refreshRadiusLayer(entry) {
  entry.radiusSource.clear();
  if (entry.isMini) return;
  const center = latLonToCoord(MOCK.poi.coords);
  buildRadiusFeatures(center).forEach((f) => {
    if (f.get("radiusVisible") !== false) entry.radiusSource.addFeature(f);
  });
}

function clearInfraOverlays(entry) {
  entry.infraOverlays.forEach(({ overlay }) => entry.map.removeOverlay(overlay));
  entry.infraOverlays = [];
}

function addInfraMarkers(entry) {
  clearInfraOverlays(entry);
  const { map, popupOverlay, popupEl } = entry;

  MOCK.infraObjects.forEach((obj) => {
    const coord = infraToCoord(obj);
    const el = createInfraElement(obj);
    const meta = SUBTYPE_META[obj.subtype] || { label: obj.subtype };
    const layerRefs = Object.keys(LAYER_SUBTYPES).filter((ref) => subtypeMatchesLayer(obj.subtype, ref));
    const visible = layerRefs.every((ref) => {
      const layer = MOCK.layers.find((l) => l.layerRef === ref);
      return layer ? layer.visible !== false : true;
    });

    el.addEventListener("click", (e) => {
      e.stopPropagation();
      popupEl.innerHTML = `<strong>${obj.name}</strong><br>${meta.label}`;
      popupEl.style.display = "block";
      popupOverlay.setPosition(coord);
    });

    const overlay = new ol.Overlay({
      element: el,
      positioning: "center-center",
      position: coord,
    });
    overlay.set("infraVisible", visible);
    el.style.display = visible ? "" : "none";
    map.addOverlay(overlay);
    entry.infraOverlays.push({ overlay, element: el, subtype: obj.subtype, layerRefs });
  });

  if (typeof refreshIcons === "function") refreshIcons();
}

function setupPoiOverlay(entry, center, mapTarget) {
  const { map, popupOverlay, popupEl } = entry;
  if (entry.poiOverlay) map.removeOverlay(entry.poiOverlay);

  const poiEl = createPoiElement();
  poiEl.style.cursor = "pointer";
  poiEl.addEventListener("click", (e) => {
    e.stopPropagation();
    popupEl.innerHTML = `<strong>${MOCK.poi.name}</strong><br>${MOCK.poi.volume} тыс. тн/год`;
    popupEl.style.display = "block";
    popupOverlay.setPosition(center);
  });

  const poiLayer = MOCK.layers.find((l) => l.layerRef === "poi");
  const poiVisible = poiLayer ? poiLayer.visible !== false : true;
  poiEl.style.display = poiVisible ? "" : "none";

  entry.poiOverlay = new ol.Overlay({
    element: poiEl,
    positioning: "center-center",
    position: center,
  });
  entry.poiElement = poiEl;
  map.addOverlay(entry.poiOverlay);
}

function bindMapInteractions(entry, center, mapTarget) {
  const { map, popupOverlay, popupEl } = entry;

  if (!entry.isMini) {
    map.on("pointermove", (evt) => {
      const c = document.getElementById("map-coords");
      if (!c) return;
      const lonLat = ol.proj.toLonLat(evt.coordinate);
      c.textContent = `${lonLat[1].toFixed(4)}, ${lonLat[0].toFixed(4)}`;
    });

    map.getView().on("change:resolution", () => updateMapScale(entry));
    updateMapScale(entry);
  }

  map.on("click", (evt) => {
    if (mapDrawMode === "poi" && !entry.isMini) {
      handleMapPoiClick(evt.coordinate);
      return;
    }
    if (mapDrawMode === "point" && !entry.isMini) {
      handleMapPointClick(entry, evt.coordinate);
      return;
    }
    if (mapDrawMode === "line" && !entry.isMini) {
      handleMapLineClick(entry, evt.coordinate);
      return;
    }
    popupEl.style.display = "none";
    popupOverlay.setPosition(undefined);
  });
}

function handleMapPoiClick(coordinate) {
  const lonLat = ol.proj.toLonLat(coordinate);
  if (typeof openMapPoiModal === "function") {
    openMapPoiModal(lonLat[1], lonLat[0]);
    return;
  }
  window._pendingMapPoi = { lat: lonLat[1], lon: lonLat[0] };
  if (typeof openModal === "function") openModal("map-add-poi");
}

function handleMapPointClick(entry, coordinate) {
  if (typeof openModal !== "function") return;
  const lonLat = ol.proj.toLonLat(coordinate);
  window._pendingMapPoint = { lat: lonLat[1], lon: lonLat[0] };
  openModal("map-add-point");
}

function handleMapLineClick(entry, coordinate) {
  if (!lineDrawFirstCoord) {
    lineDrawFirstCoord = coordinate;
    if (typeof showToast === "function") showToast("Выберите вторую точку линии", "info");
    return;
  }
  entry.manualLinesSource.addFeature(
    new ol.Feature({
      geometry: new ol.geom.LineString([lineDrawFirstCoord, coordinate]),
      manualLine: true,
    })
  );
  lineDrawFirstCoord = null;
  if (typeof showToast === "function") showToast("Линейный объект добавлен", "success");
}

function createMapEntry(containerId, isMini) {
  const container = document.getElementById(containerId);
  if (!container || typeof ol === "undefined") return null;

  const center = latLonToCoord(MOCK.poi.coords);
  const basemapLayer = new ol.layer.Tile({ source: getBasemapSource(currentBasemapId), zIndex: 0 });

  const radiusSource = new ol.source.Vector();
  const radiusLayer = new ol.layer.Vector({
    source: radiusSource,
    style: (f) => circleStyle(f.get("radiusStyle") || "#9e9e9e"),
    zIndex: 1,
  });

  const manualLinesSource = new ol.source.Vector();
  const manualLinesLayer = new ol.layer.Vector({
    source: manualLinesSource,
    style: () => lineStyle("#455a64", false),
    zIndex: 2,
  });

  const connectionSource = new ol.source.Vector();
  const connectionLayer = new ol.layer.Vector({
    source: connectionSource,
    style: (f) => lineStyle(f.get("lineColor") || "#0b5cad", f.get("lineDashed")),
    zIndex: 3,
  });

  const map = new ol.Map({
    target: containerId,
    layers: [basemapLayer, radiusLayer, manualLinesLayer, connectionLayer],
    view: new ol.View({ center, zoom: isMini ? 9 : 10 }),
    controls: getDefaultControls(isMini),
  });

  const popupEl = createPopupElement();
  popupEl.style.display = "none";
  container.appendChild(popupEl);
  const popupOverlay = new ol.Overlay({
    element: popupEl,
    positioning: "bottom-center",
    offset: [0, -12],
    stopEvent: false,
  });
  map.addOverlay(popupOverlay);

  const entry = {
    containerId,
    map,
    basemapLayer,
    basemapId: currentBasemapId,
    radiusSource,
    radiusLayer,
    manualLinesSource,
    connectionSource,
    connectionLayer,
    connectionOverlays: [],
    infraOverlays: [],
    poiOverlay: null,
    poiElement: null,
    popupEl,
    popupOverlay,
    isMini,
  };

  mapRegistry.set(containerId, entry);
  refreshRadiusLayer(entry);
  setupPoiOverlay(entry, center, container);
  addInfraMarkers(entry);
  bindMapInteractions(entry, center, container);
  return entry;
}

function isContainerVisible(container) {
  if (!container) return false;
  const rect = container.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function olDestroyMap(containerId) {
  const entry = mapRegistry.get(containerId);
  if (entry) {
    entry.map.setTarget(null);
    if (typeof entry.map.dispose === "function") entry.map.dispose();
    mapRegistry.delete(containerId);
  }
  const container = document.getElementById(containerId);
  if (container) container.innerHTML = "";
}

function olScheduleMapResize(containerId, callback) {
  requestAnimationFrame(() => {
    const entry = mapRegistry.get(containerId);
    if (entry) {
      entry.map.updateSize();
      if (typeof callback === "function") callback(entry);
    }
    requestAnimationFrame(() => {
      const e = mapRegistry.get(containerId);
      if (e) e.map.updateSize();
    });
  });
}

function olInitMap(containerId = "map-container", isMini = false) {
  if (typeof ol === "undefined") {
    const msg = "OpenLayers не загружен. Обновите страницу (Ctrl+F5) или проверьте доступ к vendor/ и CDN.";
    if (containerId === "map-container") setMapStatus(msg, true);
    if (typeof showToast === "function") showToast(msg, "error");
    return;
  }

  const container = document.getElementById(containerId);
  if (!container) return;

  let entry = mapRegistry.get(containerId);
  const visible = isContainerVisible(container);

  // Не создавать карту в скрытом контейнере (GitHub Pages / SPA): OL получает 0×0 и «ломается»
  if (!visible) {
    if (entry) {
      olDestroyMap(containerId);
    }
    return;
  }

  if (entry) {
    const rect = container.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) {
      olDestroyMap(containerId);
      entry = null;
    }
  }

  if (entry) {
    olScheduleMapResize(containerId, () => {
      const e = mapRegistry.get(containerId);
      if (!e) return;
      addInfraMarkers(e);
      olDrawConnectionLines(containerId);
      updateMapScale(e);
      if (typeof refreshIcons === "function") refreshIcons();
    });
    return;
  }

  try {
    entry = createMapEntry(containerId, isMini);
  } catch (err) {
    console.error("olInitMap failed", containerId, err);
    if (containerId === "map-container") {
      setMapStatus(`Ошибка инициализации карты: ${err.message}`, true);
    }
    return;
  }
  if (!entry) return;
  if (containerId === "map-container") setMapStatus("");
  olScheduleMapResize(containerId, () => {
    olDrawConnectionLines(containerId);
    if (typeof refreshIcons === "function") refreshIcons();
  });
}

function olDrawConnectionLines(containerId, analysisRows) {
  const entry = mapRegistry.get(containerId);
  if (!entry) return;

  const rows =
    analysisRows ||
    (typeof getAnalysisForVariant === "function"
      ? getAnalysisForVariant(typeof selectedVariantIndex !== "undefined" ? selectedVariantIndex : 0)
      : MOCK.analysis);

  const { map, connectionSource, connectionOverlays } = entry;
  connectionSource.clear();
  connectionOverlays.forEach((o) => map.removeOverlay(o));
  entry.connectionOverlays = [];

  const poi = latLonToCoord(MOCK.poi.coords);

  rows
    .filter((a) => a.distance != null && a.status !== "not_required")
    .forEach((a) => {
      const obj =
        MOCK.infraObjects.find((o) => a.object.includes(o.name.split(" ")[0]) || a.object === o.name) ||
        MOCK.infraObjects[0];
      const target = infraToCoord(obj);
      const color = LINE_STATUS_COLORS[a.status] || "#0b5cad";
      const dashed = a.status === "construction_required";

      connectionSource.addFeature(
        new ol.Feature({
          geometry: new ol.geom.LineString([poi, target]),
          lineColor: color,
          lineDashed: dashed,
        })
      );

      const mid = [(poi[0] + target[0]) / 2, (poi[1] + target[1]) / 2];
      const labelEl = document.createElement("div");
      const labelClass =
        a.status === "exceeds_limit"
          ? "exceeds"
          : a.status === "construction_required"
            ? "construction"
            : "within";
      labelEl.className = `distance-label ${labelClass}`;
      labelEl.textContent = `${a.distance} км`;

      const labelOverlay = new ol.Overlay({
        element: labelEl,
        positioning: "center-center",
        position: mid,
      });
      map.addOverlay(labelOverlay);
      entry.connectionOverlays.push(labelOverlay);
    });
}

function olSetBasemap(containerId, basemapId) {
  currentBasemapId = basemapId;
  const entry = mapRegistry.get(containerId);
  if (entry) {
    entry.basemapId = basemapId;
    entry.basemapLayer.setSource(getBasemapSource(basemapId));
  }
  mapRegistry.forEach((e, id) => {
    if (id !== containerId && e.basemapId !== basemapId) {
      e.basemapId = basemapId;
      e.basemapLayer.setSource(getBasemapSource(basemapId));
    }
  });
}

function olApplyMapBasemap() {
  if (currentBasemapId !== "osm") return;
  mapRegistry.forEach((entry) => {
    entry.basemapLayer.setSource(getBasemapSource("osm"));
  });
}

function olSetRadiusVisible(radiusId, visible) {
  const r = MOCK.radii.find((x) => x.id === radiusId);
  if (r) r.checked = visible;
  mapRegistry.forEach((entry) => refreshRadiusLayer(entry));
}

function olSetDataLayerVisible(layerRef, visible) {
  const layer = MOCK.layers.find((l) => l.layerRef === layerRef);
  if (layer) layer.visible = visible;

  mapRegistry.forEach((entry) => {
    if (layerRef === "poi" && entry.poiElement) {
      entry.poiElement.style.display = visible ? "" : "none";
    }
    entry.infraOverlays.forEach(({ element, subtype }) => {
      if (subtypeMatchesLayer(subtype, layerRef)) {
        const show = Object.keys(LAYER_SUBTYPES)
          .filter((ref) => subtypeMatchesLayer(subtype, ref))
          .every((ref) => {
            const l = MOCK.layers.find((x) => x.layerRef === ref);
            return l ? l.visible !== false : true;
          });
        element.style.display = show ? "" : "none";
      }
    });
  });
}

function olSetDrawMode(mode) {
  mapDrawMode = mode;
  lineDrawFirstCoord = null;
}

function olRefreshInfraMarkers() {
  mapRegistry.forEach((entry) => addInfraMarkers(entry));
}

function olDestroyReportMap() {
  olDestroyMap("report-map");
}

function olInitReportMap(variantIndex) {
  const containerId = "report-map";
  if (typeof ol === "undefined") return;

  const container = document.getElementById(containerId);
  if (!container) return;

  const reportView = document.getElementById("view-report");
  if (reportView?.classList.contains("hidden")) return;

  olDestroyReportMap();

  const vi = variantIndex ?? (typeof selectedVariantIndex !== "undefined" ? selectedVariantIndex : 0);
  const analysis = getAnalysisForVariant(vi);
  const center = latLonToCoord(MOCK.poi.coords);

  const basemapLayer = new ol.layer.Tile({
    source: createXyzSource(BASEMAPS.osm.light, "© OpenStreetMap © CARTO"),
    zIndex: 0,
  });

  const lineSource = new ol.source.Vector();
  const poi = center;
  analysis
    .filter((a) => a.distance != null && a.status !== "not_required")
    .forEach((a) => {
      const obj =
        MOCK.infraObjects.find((o) => a.object.includes(o.name.split(" ")[0]) || a.object === o.name) ||
        MOCK.infraObjects[0];
      const color = LINE_STATUS_COLORS[a.status] || "#0b5cad";
      lineSource.addFeature(
        new ol.Feature({
          geometry: new ol.geom.LineString([poi, infraToCoord(obj)]),
          lineColor: color,
          lineDashed: a.status === "construction_required",
        })
      );
    });

  const lineLayer = new ol.layer.Vector({
    source: lineSource,
    style: (f) => lineStyle(f.get("lineColor") || "#0b5cad", f.get("lineDashed")),
    zIndex: 2,
  });

  const map = new ol.Map({
    target: containerId,
    layers: [basemapLayer, lineLayer],
    view: new ol.View({ center, zoom: 9 }),
    controls: getDefaultControls(true),
  });

  const poiEl = createPoiElement();
  map.addOverlay(new ol.Overlay({ element: poiEl, positioning: "center-center", position: center }));

  MOCK.infraObjects.slice(0, 6).forEach((obj) => {
    const el = createInfraElement(obj);
    map.addOverlay(
      new ol.Overlay({ element: el, positioning: "center-center", position: infraToCoord(obj) })
    );
  });

  mapRegistry.set(containerId, {
    map,
    basemapLayer,
    isMini: true,
    connectionOverlays: [],
    infraOverlays: [],
  });

  olScheduleMapResize(containerId, () => {
    if (typeof refreshIcons === "function") refreshIcons();
  });
}

function olRefreshReportMap(variantIndex) {
  const reportView = document.getElementById("view-report");
  if (reportView?.classList.contains("hidden")) return;
  olInitReportMap(variantIndex);
}

function olHasMap(containerId) {
  return mapRegistry.has(containerId);
}

function olConfirmMapPoint(subtype, name) {
  const pending = window._pendingMapPoint;
  if (!pending) return;
  const meta = SUBTYPE_META[subtype] || { color: "#666" };
  MOCK.infraObjects.push({
    id: `io_${Date.now()}`,
    name: name || "Новый объект",
    subtype,
    lat: pending.lat,
    lon: pending.lon,
    color: meta.color,
  });
  window._pendingMapPoint = null;
  olRefreshInfraMarkers();
  const mainEntry = mapRegistry.get("map-container");
  if (mainEntry) {
    olScheduleMapResize("map-container", () => addInfraMarkers(mainEntry));
  }
}

/** Обновить положение маркера POI и линии после сохранения координат */
function olUpdatePoiOnMap() {
  if (!MOCK.poi?.coords) return;
  const center = latLonToCoord(MOCK.poi.coords);
  mapRegistry.forEach((entry, containerId) => {
    if (entry.poiOverlay) entry.poiOverlay.setPosition(center);
    if (!entry.isMini && entry.map) {
      entry.map.getView().animate({ center, duration: 350 });
    }
    olDrawConnectionLines(containerId);
  });
  const coordsEl = document.getElementById("map-coords");
  if (coordsEl) {
    coordsEl.textContent = `${MOCK.poi.coords[0].toFixed(4)}, ${MOCK.poi.coords[1].toFixed(4)}`;
  }
}
