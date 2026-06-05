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
import {
  RENDER_3D_MODEL_ID_KEY,
  RENDER_3D_STYLE_KEY,
  resolveRender3D,
} from '../../lib/map3d/render3d';
import { render3dModelSelectValue } from '../../lib/map3d/render3dModelOptions';
import { poiToFormValues, type PoiFormValues } from '../../lib/poiParams';
import { POI_TAB_FIELDS, type InfraDetailTab, type PoiDetailTab } from './constants';
import { capacityDraftFromObject, pickPoiFields, sandDemandFieldsDirty } from './helpers';

export type InfraDirtyDraft = {
  name: string;
  description: string;
  subtype: string;
  layerId: string;
  lon: string;
  lat: string;
  sandInitialM3: string;
  sandCurrentM3: string;
  sandDemandM3: string;
  sandVolumeByYear: Record<string, number>;
  sandVolumeMode: SandVolumeInputMode;
  entryDate: string;
  capacityValue: number | '';
  render3dHeight: string;
  render3dBase: string;
  render3dScale: string;
  render3dVisible: boolean;
  render3dStyle: string;
  render3dModelId: string;
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

function render3dFieldsDirty(
  infraObject: InfraObject,
  draft: InfraDirtyDraft,
  map3dCustomModels: Map3dCustomModel[],
): boolean {
  const origR3 = resolveRender3D(infraObject.subtype, infraObject.properties);
  const origStyle = (infraObject.properties?.[RENDER_3D_STYLE_KEY] as string) || '';
  const origModelId = (infraObject.properties?.[RENDER_3D_MODEL_ID_KEY] as string) || '';
  const origModelSelect = render3dModelSelectValue(
    infraObject.subtype,
    map3dCustomModels,
    origModelId,
  );
  return (
    draft.render3dHeight !== String(origR3.heightM) ||
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
  const r3Dirty = render3dFieldsDirty(infraObject, draft, map3dCustomModels);
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
    r3Dirty
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
    entryDirty ||
    (pointShowsThroughputCapacity(infraObject.subtype) &&
      !isLine &&
      draft.capacityValue !== capacityDraftFromObject(infraObject));

  switch (tab) {
    case 'main':
      return mainDirty;
    case 'logistics':
      return sandDirty;
    case 'extra':
      return draft.description !== origDesc || render3dFieldsDirty(infraObject, draft, map3dCustomModels);
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
