import { coordForSave, parseCoord } from '../../lib/coords';
import type { InfraObject } from '../../lib/api';
import { isEarthworkEligibleSubtype } from '../../lib/infraPadEarthwork';
import { getLineCoordinates, isLineSubtype } from '../../lib/infraGeometry';
import {
  defaultCapacityUnitForSubtype,
  mergeThroughputCapacity,
  pointShowsThroughputCapacity,
} from '../../lib/infraCapacity';
import {
  isSandQuarrySubtype,
  mergeQuarryVolumes,
  mergeSandVolumeForSave,
  pointShowsSandDemand,
  stripSandVolumeProperties,
  type SandVolumeInputMode,
} from '../../lib/infraSandVolumes';
import {
  bottomholeFormFieldsToProperties,
  type BottomholeFormFields,
} from './bottomholeFormFields';
import {
  isBottomholeSubtype,
  WELL_BOTTOMHOLE_GS_SUBTYPE,
} from '../../lib/wellBottomholeProperties';
import { mergeEntryDate, objectShowsEntryDate } from '../../lib/infraEntryDate';
import {
  mergePadWellParams,
  padWellFieldsFromForm,
  pointShowsPadWellFields,
} from '../../lib/infraPadWells';
import {
  DEFAULT_RENDER_3D_SCALE,
  MAX_RENDER_3D_SCALE,
  MIN_RENDER_3D_SCALE,
  RENDER_3D_BASE_FROM_DEM_KEY,
  RENDER_3D_BASE_KEY,
  RENDER_3D_DIAMETER_KEY,
  RENDER_3D_HEIGHT_KEY,
  RENDER_3D_MODEL_ID_KEY,
  RENDER_3D_SCALE_KEY,
  RENDER_3D_STYLE_KEY,
  RENDER_3D_VISIBLE_KEY,
} from '../../lib/map3d/render3d';
import {
  writePointFootprintLineConnections,
  type PointFootprintLineConnections,
} from '../../lib/padFootprintLineAttach';
import {
  clampLineProfileStepM,
  LINE_ELEVATION_PROFILE_STEP_M,
  lineProfileEligible,
} from '../../lib/lineElevationProfile';

export type InfraSaveDraft = {
  name: string;
  description: string;
  subtype: string;
  layerId: string;
  lon: string;
  lat: string;
  endLon: string;
  endLat: string;
  sandInitialM3: string;
  sandCurrentM3: string;
  sandDemandM3: string;
  sandVolumeByYear: Record<string, number>;
  sandVolumeMode: SandVolumeInputMode;
  entryDate: string;
  capacityValue: number | '';
  render3dHeight: string;
  render3dDiameter: string;
  render3dBase: string;
  render3dScale: string;
  render3dVisible: boolean;
  render3dStyle: string;
  render3dModelId: string;
  padWellCount: string;
  padWellsPerGroup: string;
  padWellSpacingM: string;
  padGroupSpacingM: string;
  padMarginLeftM: string;
  padMarginBottomM: string;
  padMarginTopM: string;
  padMarginEndM: string;
  pointFootprintLineConnections: PointFootprintLineConnections;
  bottomholeFields: BottomholeFormFields;
  lineProfileStepM: string;
};

export function buildInfraSavePayload(
  draft: InfraSaveDraft,
  object: InfraObject,
): Record<string, unknown> {
  const {
    name,
    description,
    subtype,
    layerId,
    lon,
    lat,
    endLon,
    endLat,
    sandInitialM3,
    sandCurrentM3,
    sandDemandM3,
    sandVolumeByYear,
    sandVolumeMode,
    entryDate,
    capacityValue,
    render3dHeight,
    render3dDiameter,
    render3dBase,
    render3dScale,
    render3dVisible,
    render3dStyle,
    render3dModelId,
    padWellCount,
    padWellsPerGroup,
    padWellSpacingM,
    padGroupSpacingM,
    padMarginLeftM,
    padMarginBottomM,
    padMarginTopM,
    padMarginEndM,
    pointFootprintLineConnections,
    bottomholeFields,
    lineProfileStepM,
  } = draft;

  const payload: Record<string, unknown> = {
    name,
    description,
    subtype,
    layer_id: layerId,
  };

  let props: Record<string, unknown> = { ...(object.properties ?? {}), description };
  if (isSandQuarrySubtype(subtype) && !isLineSubtype(subtype)) {
    const initial = sandInitialM3.trim() ? parseFloat(sandInitialM3) : null;
    const current = sandCurrentM3.trim() ? parseFloat(sandCurrentM3) : null;
    props = mergeQuarryVolumes(props, initial, current);
  } else if (pointShowsSandDemand(subtype)) {
    const demand = sandDemandM3.trim() ? parseFloat(sandDemandM3) : null;
    props = mergeSandVolumeForSave(props, sandVolumeMode, demand, sandVolumeByYear);
  }
  if (objectShowsEntryDate(subtype)) {
    props = mergeEntryDate(props, entryDate.trim() || null);
  }
  if (pointShowsThroughputCapacity(subtype) && !isLineSubtype(subtype)) {
    const capacity = capacityValue === '' ? null : capacityValue;
    props = mergeThroughputCapacity(props, capacity, defaultCapacityUnitForSubtype(subtype));
  }
  if (pointShowsPadWellFields(subtype) && !isLineSubtype(subtype)) {
    props = mergePadWellParams(
      props,
      padWellFieldsFromForm({
        padWellCount,
        padWellsPerGroup,
        padWellSpacingM,
        padGroupSpacingM,
        padMarginLeftM,
        padMarginBottomM,
        padMarginTopM,
        padMarginEndM,
      }),
    );
  }
  const h = render3dHeight.trim() ? parseFloat(render3dHeight) : null;
  const d = render3dDiameter.trim() ? parseFloat(render3dDiameter.replace(',', '.')) : null;
  const b = render3dBase.trim() ? parseFloat(render3dBase) : null;
  const isTubeLine = isLineSubtype(subtype) && subtype !== 'power_line';
  if (isTubeLine) {
    if (d != null && Number.isFinite(d) && d > 0) {
      props[RENDER_3D_DIAMETER_KEY] = d;
    }
  } else if (h != null && Number.isFinite(h) && h >= 0) {
    props[RENDER_3D_HEIGHT_KEY] = h;
  }
  if (b != null && Number.isFinite(b) && b >= 0) {
    props[RENDER_3D_BASE_KEY] = b;
    const origRaw = object.properties?.[RENDER_3D_BASE_KEY];
    const origBase =
      typeof origRaw === 'number'
        ? origRaw
        : typeof origRaw === 'string' && origRaw.trim()
          ? Number(origRaw.replace(',', '.'))
          : 0;
    const baseChanged = !Number.isFinite(origBase) || Math.abs(origBase - b) > 1e-6;
    if (baseChanged) {
      props[RENDER_3D_BASE_FROM_DEM_KEY] = false;
    } else if (object.properties?.[RENDER_3D_BASE_FROM_DEM_KEY] === true) {
      props[RENDER_3D_BASE_FROM_DEM_KEY] = true;
    }
  }
  const scRaw = render3dScale.trim().replace(',', '.');
  const sc = scRaw ? parseFloat(scRaw) : null;
  if (sc != null && Number.isFinite(sc) && sc > 0) {
    const clamped = Math.min(MAX_RENDER_3D_SCALE, Math.max(MIN_RENDER_3D_SCALE, sc));
    props[RENDER_3D_SCALE_KEY] = clamped;
  } else {
    props[RENDER_3D_SCALE_KEY] = DEFAULT_RENDER_3D_SCALE;
  }
  props[RENDER_3D_VISIBLE_KEY] = render3dVisible;
  if (!isLineSubtype(subtype)) {
    if (render3dStyle === 'model' || render3dStyle === 'extrusion') {
      props[RENDER_3D_STYLE_KEY] = render3dStyle;
    } else {
      props[RENDER_3D_STYLE_KEY] = null;
    }
    const mid = render3dModelId.trim();
    if (mid) {
      props[RENDER_3D_MODEL_ID_KEY] = mid;
      if (mid.toLowerCase().startsWith('custom:')) {
        props[RENDER_3D_STYLE_KEY] = 'model';
      }
    } else {
      props[RENDER_3D_MODEL_ID_KEY] = null;
    }
  }
  if (!isLineSubtype(subtype) && isEarthworkEligibleSubtype(subtype)) {
    props = writePointFootprintLineConnections(
      props,
      Object.keys(pointFootprintLineConnections).length ? pointFootprintLineConnections : null,
    );
  }
  if (isBottomholeSubtype(subtype)) {
    props = { ...props, ...bottomholeFormFieldsToProperties(bottomholeFields) };
    props = stripSandVolumeProperties(props);
  }
  if (isLineSubtype(subtype) && lineProfileEligible(subtype)) {
    const stepRaw = (lineProfileStepM ?? '').trim();
    const step = stepRaw
      ? clampLineProfileStepM(lineProfileStepM)
      : clampLineProfileStepM(undefined);
    props[LINE_ELEVATION_PROFILE_STEP_M] = step;
  }
  payload.properties = props;

  const saveLon = coordForSave(parseCoord(lon), object.lon, lon);
  const saveLat = coordForSave(parseCoord(lat), object.lat, lat);

  if (subtype === WELL_BOTTOMHOLE_GS_SUBTYPE) {
    const saveEndLon = coordForSave(parseCoord(endLon), object.end_lon, endLon);
    const saveEndLat = coordForSave(parseCoord(endLat), object.end_lat, endLat);
    payload.lon = saveLon;
    payload.lat = saveLat;
    payload.end_lon = saveEndLon;
    payload.end_lat = saveEndLat;
    payload.coordinates = [
      [saveLon, saveLat],
      [saveEndLon, saveEndLat],
    ];
  } else if (isLineSubtype(subtype)) {
    const coords = getLineCoordinates(object);
    if (coords) {
      const next = coords.map((c) => [...c] as [number, number]);
      next[0] = [saveLon, saveLat];
      payload.coordinates = next;
      payload.lon = next[0][0];
      payload.lat = next[0][1];
      payload.end_lon = next[next.length - 1][0];
      payload.end_lat = next[next.length - 1][1];
    } else {
      payload.lon = saveLon;
      payload.lat = saveLat;
    }
  } else {
    payload.lon = saveLon;
    payload.lat = saveLat;
  }

  return payload;
}
