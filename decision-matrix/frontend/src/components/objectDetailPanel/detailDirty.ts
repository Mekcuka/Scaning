import { formatCoord } from '../../lib/coords';
import type { InfraObject, Map3dCustomModel, POI } from '../../lib/api';
import { pointShowsThroughputCapacity } from '../../lib/infraCapacity';
import {
  isSandQuarrySubtype,
  pointShowsSandDemand,
  readQuarryVolumes,
  type SandVolumeInputMode,
} from '../../lib/infraSandVolumes';
import { objectShowsEntryDate, readEntryDateIso } from '../../lib/infraEntryDate';
import { padWellFieldsDirty, pointShowsPadWellFields } from '../../lib/infraPadWells';
import {
  RENDER_3D_MODEL_ID_KEY,
  RENDER_3D_STYLE_KEY,
  resolveRender3D,
} from '../../lib/map3d/render3d';
import { resolvedLineDiameterM } from '../../lib/map3d/map3dLineTubeRadius';
import { isLineSubtype } from '../../lib/infraGeometry';
import {
  clampLineProfileStepM,
  lineProfileEligible,
  readLineProfileStepM,
} from '../../lib/lineElevationProfile';
import { render3dModelSelectValue } from '../../lib/map3d/render3dModelOptions';
import { poiToFormValues, type PoiFormValues } from '../../lib/poiParams';
import { POI_TAB_FIELDS, type InfraDetailTab, type PoiDetailTab } from './constants';
import { capacityDraftFromObject, pickPoiFields, sandDemandFieldsDirty } from './helpers';
import {
  pointFootprintLineConnectionsEqual,
  readPointFootprintLineConnections,
  type PointFootprintLineConnections,
} from '../../lib/padFootprintLineAttach';
import { isEarthworkEligibleSubtype } from '../../lib/infraPadEarthwork';
import { bottomholeFormFieldsDirty, type BottomholeFormFields } from './bottomholeFormFields';

export type InfraDirtyDraft = {
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

function sandFieldsDirty(
  infraObject: InfraObject,
  draft: InfraDirtyDraft,
  isLine: boolean,
): boolean {
  const origQ = readQuarryVolumes(infraObject.properties);
  return (
    (isSandQuarrySubtype(infraObject.subtype) &&
      !isLine &&
      (draft.sandInitialM3 !== (origQ.initial > 0 ? String(origQ.initial) : '') ||
        draft.sandCurrentM3 !== (origQ.current > 0 ? String(origQ.current) : ''))) ||
    (pointShowsSandDemand(infraObject.subtype) &&
      !isLine &&
      sandDemandFieldsDirty(infraObject.properties, {
        mode: draft.sandVolumeMode,
        singleDemand: draft.sandDemandM3,
        yearPlan: draft.sandVolumeByYear,
      }))
  );
}

function lineProfileStepDirty(
  infraObject: InfraObject,
  draft: InfraDirtyDraft,
  isLine: boolean,
): boolean {
  return (
    isLine &&
    lineProfileEligible(infraObject.subtype) &&
    draft.lineProfileStepM.trim() !== '' &&
    String(readLineProfileStepM(infraObject.properties)) !==
      String(clampLineProfileStepM(draft.lineProfileStepM))
  );
}

function render3dFieldsDirty(
  infraObject: InfraObject,
  draft: InfraDirtyDraft,
  map3dCustomModels: Map3dCustomModel[],
): boolean {
  const origR3 = resolveRender3D(infraObject.subtype, infraObject.properties);
  const isTubeLine =
    isLineSubtype(infraObject.subtype) && infraObject.subtype !== 'power_line';
  const origStyle = (infraObject.properties?.[RENDER_3D_STYLE_KEY] as string) || '';
  const origModelId = (infraObject.properties?.[RENDER_3D_MODEL_ID_KEY] as string) || '';
  const origModelSelect = render3dModelSelectValue(
    infraObject.subtype,
    map3dCustomModels,
    origModelId,
  );
  const primaryDimDirty = isTubeLine
    ? draft.render3dDiameter !== String(resolvedLineDiameterM(infraObject.subtype, origR3))
    : draft.render3dHeight !== String(origR3.heightM);
  return (
    primaryDimDirty ||
    draft.render3dBase !== String(origR3.baseM) ||
    draft.render3dScale !== String(origR3.scale) ||
    draft.render3dVisible !== origR3.visible ||
    draft.render3dStyle !== origStyle ||
    draft.render3dModelId !== origModelSelect
  );
}

export function computeInfraIsDirty(
  infraObject: InfraObject,
  draft: InfraDirtyDraft,
  map3dCustomModels: Map3dCustomModel[],
  isLine: boolean,
): boolean {
  const origDesc = (infraObject.properties?.description as string) || '';
  const sandDirty = sandFieldsDirty(infraObject, draft, isLine);
  const entryDirty =
    objectShowsEntryDate(infraObject.subtype) &&
    draft.entryDate !== readEntryDateIso(infraObject.properties);
  const capacityDirty =
    pointShowsThroughputCapacity(infraObject.subtype) &&
    !isLine &&
    draft.capacityValue !== capacityDraftFromObject(infraObject);
  const padWellDirty =
    pointShowsPadWellFields(infraObject.subtype) &&
    !isLine &&
    padWellFieldsDirty(infraObject.properties, draft);
  const r3Dirty = render3dFieldsDirty(infraObject, draft, map3dCustomModels);
  const attachDirty =
    !isLine &&
    isEarthworkEligibleSubtype(infraObject.subtype) &&
    !pointFootprintLineConnectionsEqual(
      draft.pointFootprintLineConnections,
      readPointFootprintLineConnections(infraObject.properties),
    );
  const bottomholeDirty = bottomholeFormFieldsDirty(
    infraObject.properties,
    draft.bottomholeFields,
  );
  const gsEndDirty =
    infraObject.subtype === 'well_bottomhole_gs' &&
    (draft.endLon !== (infraObject.end_lon != null ? formatCoord(infraObject.end_lon) : '') ||
      draft.endLat !== (infraObject.end_lat != null ? formatCoord(infraObject.end_lat) : ''));
  const profileStepDirty = lineProfileStepDirty(infraObject, draft, isLine);
  return (
    draft.name !== infraObject.name ||
    draft.description !== origDesc ||
    draft.subtype !== infraObject.subtype ||
    draft.layerId !== infraObject.layer_id ||
    draft.lon !== formatCoord(infraObject.lon) ||
    draft.lat !== formatCoord(infraObject.lat) ||
    sandDirty ||
    entryDirty ||
    capacityDirty ||
    padWellDirty ||
    r3Dirty ||
    attachDirty ||
    bottomholeDirty ||
    gsEndDirty ||
    profileStepDirty
  );
}

export function computeInfraTabDirty(
  tab: InfraDetailTab,
  infraObject: InfraObject,
  draft: InfraDirtyDraft,
  map3dCustomModels: Map3dCustomModel[],
  isLine: boolean,
): boolean {
  const origDesc = (infraObject.properties?.description as string) || '';
  const sandDirty = sandFieldsDirty(infraObject, draft, isLine);
  const entryDirty =
    objectShowsEntryDate(infraObject.subtype) &&
    draft.entryDate !== readEntryDateIso(infraObject.properties);
  const mainDirty =
    draft.subtype !== infraObject.subtype ||
    draft.layerId !== infraObject.layer_id ||
    draft.lon !== formatCoord(infraObject.lon) ||
    draft.lat !== formatCoord(infraObject.lat) ||
    draft.description !== origDesc ||
    entryDirty ||
    (pointShowsThroughputCapacity(infraObject.subtype) &&
      !isLine &&
      draft.capacityValue !== capacityDraftFromObject(infraObject)) ||
    (pointShowsPadWellFields(infraObject.subtype) &&
      !isLine &&
      padWellFieldsDirty(infraObject.properties, draft)) ||
    (isEarthworkEligibleSubtype(infraObject.subtype) &&
      !isLine &&
      !pointFootprintLineConnectionsEqual(
        draft.pointFootprintLineConnections,
        readPointFootprintLineConnections(infraObject.properties),
      )) ||
    bottomholeFormFieldsDirty(infraObject.properties, draft.bottomholeFields) ||
    (infraObject.subtype === 'well_bottomhole_gs' &&
      (draft.endLon !== (infraObject.end_lon != null ? formatCoord(infraObject.end_lon) : '') ||
        draft.endLat !== (infraObject.end_lat != null ? formatCoord(infraObject.end_lat) : '')));

  switch (tab) {
    case 'main':
      return mainDirty;
    case 'logistics':
      return (
        sandDirty ||
        (pointShowsPadWellFields(infraObject.subtype) &&
          !isLine &&
          padWellFieldsDirty(infraObject.properties, draft))
      );
    case 'extra':
      return render3dFieldsDirty(infraObject, draft, map3dCustomModels);
    case 'trajectories':
      return false;
    case 'profile':
      return lineProfileStepDirty(infraObject, draft, isLine);
    default:
      return false;
  }
}

export function computePoiIsDirty(poi: POI, poiForm: PoiFormValues): boolean {
  const orig = poiToFormValues(poi);
  return JSON.stringify(poiForm) !== JSON.stringify(orig);
}

export function computePoiTabDirty(
  tab: PoiDetailTab,
  poiForm: PoiFormValues,
  poi: POI,
): boolean {
  const orig = poiToFormValues(poi);
  const keys = POI_TAB_FIELDS[tab];
  return JSON.stringify(pickPoiFields(poiForm, keys)) !== JSON.stringify(pickPoiFields(orig, keys));
}
