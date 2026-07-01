import { formatCoord } from '../../lib/coords';
import type { InfraObject, Map3dCustomModel, POI } from '../../lib/api';
import { poiToFormValues, type PoiFormValues } from '../../lib/poiParams';
import {
  isSandQuarrySubtype,
  pointShowsSandDemand,
  readQuarryVolumes,
  readSandDemandM3,
  readSandVolumeByYear,
  readSandVolumeInputMode,
  type SandVolumeInputMode,
} from '../../lib/infraSandVolumes';
import { objectShowsEntryDate, readEntryDateIso } from '../../lib/infraEntryDate';
import { padWellFormStringsFromObject } from '../../lib/infraPadWells';
import {
  RENDER_3D_MODEL_ID_KEY,
  RENDER_3D_STYLE_KEY,
  resolveRender3D,
} from '../../lib/map3d/render3d';
import { resolvedLineDiameterM } from '../../lib/map3d/map3dLineTubeRadius';
import { isLineSubtype } from '../../lib/infraGeometry';
import { readLineProfileStepM } from '../../lib/lineElevationProfile';
import { render3dModelSelectValue } from '../../lib/map3d/render3dModelOptions';
import type { InfraDetailTab, PoiDetailTab } from './constants';
import { capacityDraftFromObject } from './helpers';
import {
  readPointFootprintLineConnections,
  type PointFootprintLineConnections,
} from '../../lib/padFootprintLineAttach';
import {
  formatBottomholeElevation,
  readGsLineBottomholeElevations,
  readPointBottomholeElevation,
} from '../../lib/wellBottomholeElevation';
import {
  isBottomholeSubtype,
  readBottomholeLinkedPadId,
} from '../../lib/wellBottomholeProperties';

export type InfraFormDraft = {
  name: string;
  description: string;
  subtype: string;
  layerId: string;
  lon: string;
  lat: string;
  endLon: string;
  endLat: string;
  z: string;
  zHeel: string;
  zToe: string;
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
  lineProfileStepM: string;
  infraTab: InfraDetailTab;
  poiTab: PoiDetailTab;
};

export function createPoiFormFromSelection(poi: POI): PoiFormValues {
  return poiToFormValues(poi);
}

function bottomholeZFieldsFromObject(
  o: InfraObject,
  infraObjects: InfraObject[],
): { z: string; zHeel: string; zToe: string } {
  const padId = readBottomholeLinkedPadId(o.properties);
  const pad = padId ? (infraObjects.find((p) => p.id === padId) ?? null) : null;
  if (o.subtype === 'well_bottomhole_gs') {
    const { heelZ, toeZ } = readGsLineBottomholeElevations(o, pad);
    return {
      z: '',
      zHeel: formatBottomholeElevation(heelZ),
      zToe: formatBottomholeElevation(toeZ),
    };
  }
  if (isBottomholeSubtype(o.subtype)) {
    const elevation = readPointBottomholeElevation(o, pad);
    return {
      z: formatBottomholeElevation(elevation),
      zHeel: '',
      zToe: '',
    };
  }
  return { z: '', zHeel: '', zToe: '' };
}

export function createInfraFormDraftFromObject(
  o: InfraObject,
  map3dCustomModels: Map3dCustomModel[],
  infraObjects: InfraObject[] = [],
): InfraFormDraft {
  const { initial, current } = readQuarryVolumes(o.properties);
  let sandInitialM3 = '';
  let sandCurrentM3 = '';
  let sandDemandM3 = '';
  let sandVolumeByYear: Record<string, number> = {};
  let sandVolumeMode: SandVolumeInputMode = 'single';

  if (isSandQuarrySubtype(o.subtype)) {
    sandInitialM3 = initial > 0 ? String(initial) : '';
    sandCurrentM3 = current > 0 ? String(current) : '';
  } else if (pointShowsSandDemand(o.subtype)) {
    const d = readSandDemandM3(o.properties);
    sandDemandM3 = d > 0 ? String(d) : '';
    sandVolumeByYear = readSandVolumeByYear(o.properties);
    sandVolumeMode = readSandVolumeInputMode(o.properties);
  }

  const r3 = resolveRender3D(o.subtype, o.properties);
  const style = o.properties?.[RENDER_3D_STYLE_KEY];
  const modelId = o.properties?.[RENDER_3D_MODEL_ID_KEY];
  const rawMid = typeof modelId === 'string' ? modelId : '';

  return {
    name: o.name,
    description: (o.properties?.description as string) || '',
    subtype: o.subtype,
    layerId: o.layer_id,
    lon: formatCoord(o.lon),
    lat: formatCoord(o.lat),
    endLon: o.end_lon != null ? formatCoord(o.end_lon) : '',
    endLat: o.end_lat != null ? formatCoord(o.end_lat) : '',
    ...bottomholeZFieldsFromObject(o, infraObjects),
    sandInitialM3,
    sandCurrentM3,
    sandDemandM3,
    sandVolumeByYear,
    sandVolumeMode,
    entryDate: objectShowsEntryDate(o.subtype) ? readEntryDateIso(o.properties) : '',
    capacityValue: capacityDraftFromObject(o),
    render3dHeight:
      isLineSubtype(o.subtype) && o.subtype !== 'power_line'
        ? ''
        : String(r3.heightM),
    render3dDiameter:
      isLineSubtype(o.subtype) && o.subtype !== 'power_line'
        ? String(resolvedLineDiameterM(o.subtype, r3))
        : '',
    render3dBase: String(r3.baseM),
    render3dScale: String(r3.scale),
    render3dVisible: r3.visible,
    render3dStyle: typeof style === 'string' ? style : '',
    render3dModelId: render3dModelSelectValue(o.subtype, map3dCustomModels, rawMid),
    ...padWellFormStringsFromObject(o.properties),
    pointFootprintLineConnections: readPointFootprintLineConnections(o.properties),
    lineProfileStepM: isLineSubtype(o.subtype)
      ? String(readLineProfileStepM(o.properties))
      : '',
    infraTab: 'main',
    poiTab: 'basic',
  };
}
