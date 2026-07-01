import { useMemo } from 'react';
import {
  infraSubtypeSelectOptions,
  isImmutablePointSubtype,
  SUBTYPE_LABELS,
  type InfraLayer,
  type InfraObject,
  type Map3dCustomModel,
} from '../../lib/api';
import { getLineCoordinates, isLineSubtype } from '../../lib/infraGeometry';
import { formatLengthMeters, lineLengthMeters } from '../../lib/mapMeasure';
import {
  defaultCapacityUnitForSubtype,
  effectiveThroughputCapacity,
  pointShowsThroughputCapacity,
} from '../../lib/infraCapacity';
import { objectShowsEntryDate } from '../../lib/infraEntryDate';
import { isEarthworkEligibleSubtype, isPadSubtype } from '../../lib/infraPadEarthwork';
import { pointShowsPadWellFields } from '../../lib/infraPadWells';
import {
  isSandQuarrySubtype,
  pointShowsSandDemand,
} from '../../lib/infraSandVolumes';
import { lineProfileEligible, readLineProfileTotalLengthM } from '../../lib/lineElevationProfile';
import {
  bottomholesLinkedToPad,
  isBottomholeSubtype,
  logicalWellCountFromBottomholes,
  readBottomholeLinkedPadId,
} from '../../lib/wellBottomholeProperties';
import { buildRender3dModelOptions } from '../../lib/map3d/render3dModelOptions';
import { useProjectSandLogistics } from '../../hooks/useProjectSandLogistics';
import { useActiveProject } from '../../hooks/useActiveProject';
import {
  computeInfraIsDirty,
  computePoiIsDirty,
  type InfraDirtyDraft,
} from './detailDirty';
import type { SelectedFeature } from './types';
import type { useObjectDetailFormState } from './useObjectDetailFormState';

type FormState = ReturnType<typeof useObjectDetailFormState>;

export function useObjectDetailInfraDerived(params: {
  selection: SelectedFeature;
  layers: InfraLayer[];
  map3dCustomModels: Map3dCustomModel[];
  infraObjects?: InfraObject[];
  form: FormState;
}) {
  const { selection, layers, map3dCustomModels, infraObjects = [], form } = params;

  const isPoi = selection.kind === 'poi';
  const infraObject: InfraObject | null = selection.kind === 'infra' ? selection.object : null;

  const { projectId: mapProjectId } = useActiveProject();
  const resolvedMapProjectId = mapProjectId ?? null;

  const linkedBottomholes = useMemo(() => {
    if (!infraObject || !isPadSubtype(infraObject.subtype)) return [];
    return bottomholesLinkedToPad(infraObjects, infraObject.id);
  }, [infraObject, infraObjects]);

  const padWellCountDerivedFromBottomholes = linkedBottomholes.length > 0;
  const derivedPadWellCount = padWellCountDerivedFromBottomholes
    ? logicalWellCountFromBottomholes(linkedBottomholes)
    : null;
  const effectivePadWellCount =
    derivedPadWellCount != null ? String(derivedPadWellCount) : form.padWellCount;

  const infraDirtyDraft = useMemo<InfraDirtyDraft>(
    () => ({
      name: form.name,
      description: form.description,
      subtype: form.subtype,
      layerId: form.layerId,
      lon: form.lon,
      lat: form.lat,
      endLon: form.endLon,
      endLat: form.endLat,
      sandInitialM3: form.sandInitialM3,
      sandCurrentM3: form.sandCurrentM3,
      sandDemandM3: form.sandDemandM3,
      sandVolumeByYear: form.sandVolumeByYear,
      sandVolumeMode: form.sandVolumeMode,
      entryDate: form.entryDate,
      capacityValue: form.capacityValue,
      render3dHeight: form.render3dHeight,
      render3dDiameter: form.render3dDiameter,
      render3dBase: form.render3dBase,
      render3dScale: form.render3dScale,
      render3dVisible: form.render3dVisible,
      render3dStyle: form.render3dStyle,
      render3dModelId: form.render3dModelId,
      padWellCount: effectivePadWellCount,
      padWellsPerGroup: form.padWellsPerGroup,
      padWellSpacingM: form.padWellSpacingM,
      padGroupSpacingM: form.padGroupSpacingM,
      padMarginLeftM: form.padMarginLeftM,
      padMarginBottomM: form.padMarginBottomM,
      padMarginTopM: form.padMarginTopM,
      padMarginEndM: form.padMarginEndM,
      pointFootprintLineConnections: form.pointFootprintLineConnections,
      bottomholeFields: form.bottomholeFields,
      lineProfileStepM: form.lineProfileStepM,
    }),
    [form, effectivePadWellCount],
  );

  const render3dModelOptions = useMemo(() => {
    if (!infraObject) return [];
    return buildRender3dModelOptions(infraObject.subtype, map3dCustomModels);
  }, [infraObject, map3dCustomModels]);

  const isBottomhole =
    selection.kind === 'infra' && isBottomholeSubtype(selection.object.subtype);

  const linkedBottomholePad = useMemo(() => {
    if (!infraObject || !isBottomhole) return null;
    const padId = readBottomholeLinkedPadId({
      ...(infraObject.properties ?? {}),
      ...(form.bottomholeFields.linkedPadId
        ? { well_bottomhole_linked_pad_id: form.bottomholeFields.linkedPadId }
        : {}),
    });
    if (!padId) return null;
    return infraObjects.find((o) => o.id === padId) ?? null;
  }, [infraObject, isBottomhole, form.bottomholeFields, infraObjects]);

  const isLine = infraObject != null && isLineSubtype(infraObject.subtype) && !isBottomhole;
  const lineCoords = infraObject
    ? (getLineCoordinates(infraObject) as [number, number][] | null)
    : null;
  const profileLengthM = infraObject ? readLineProfileTotalLengthM(infraObject) : null;
  const geodesicLengthM =
    lineCoords && lineCoords.length >= 2 ? lineLengthMeters(lineCoords) : null;
  const effectiveLineLengthM = profileLengthM ?? geodesicLengthM;
  const lineLengthLabel =
    effectiveLineLengthM != null ? formatLengthMeters(effectiveLineLengthM) : null;
  const lineLengthFromProfile = profileLengthM != null;

  const subtypeLabel = SUBTYPE_LABELS[form.subtype] || form.subtype;
  const layerName = layers.find((l) => l.id === form.layerId)?.name;
  const sparkType =
    infraObject?.properties?.spark_type != null
      ? String(infraObject.properties.spark_type)
      : null;

  const infraSubtypeOptions =
    selection.kind === 'infra' ? infraSubtypeSelectOptions(selection.object) : [];
  const subtypeLocked =
    selection.kind === 'infra' && isImmutablePointSubtype(selection.object.subtype);

  const showThroughputCapacity =
    selection.kind === 'infra' && pointShowsThroughputCapacity(selection.object.subtype);
  const showSandQuarryFields =
    selection.kind === 'infra' && isSandQuarrySubtype(form.subtype) && !isLine;
  const showSandDemandField =
    selection.kind === 'infra' && pointShowsSandDemand(form.subtype) && !isLine;
  const showPadEarthworkSection =
    selection.kind === 'infra' &&
    isEarthworkEligibleSubtype(form.subtype) &&
    !isBottomholeSubtype(form.subtype) &&
    !isLine;
  const showTrajectoriesSection =
    selection.kind === 'infra' && isPadSubtype(form.subtype) && !isLine;
  const showProfileTab =
    selection.kind === 'infra' && isLine && lineProfileEligible(form.subtype);
  const showPadWellCountField =
    selection.kind === 'infra' && pointShowsPadWellFields(form.subtype) && !isLine;

  const sandLogisticsProjectId =
    selection.kind === 'poi' ? selection.poi.project_id : mapProjectId;
  const infraObjectId = selection.kind === 'infra' ? selection.object.id : null;
  const { data: sandLogistics } = useProjectSandLogistics(
    showSandDemandField ? sandLogisticsProjectId : null,
  );

  const showEntryDateField = selection.kind === 'infra' && objectShowsEntryDate(form.subtype);
  const quarryVolumeWarning =
    showSandQuarryFields &&
    form.sandInitialM3.trim() &&
    form.sandCurrentM3.trim() &&
    parseFloat(form.sandCurrentM3) > parseFloat(form.sandInitialM3);

  const throughputCapacity = useMemo(() => {
    if (!infraObject) return null;
    return effectiveThroughputCapacity(infraObject.subtype, infraObject.properties);
  }, [infraObject]);

  const isDirty = useMemo(() => {
    if (isPoi && form.poiForm && selection.kind === 'poi') {
      return computePoiIsDirty(selection.poi, form.poiForm);
    }
    if (!infraObject) return false;
    return computeInfraIsDirty(infraObject, infraDirtyDraft, map3dCustomModels, isLine);
  }, [isPoi, form.poiForm, selection, infraObject, infraDirtyDraft, map3dCustomModels, isLine]);

  const capacityUnit =
    throughputCapacity?.unit || defaultCapacityUnitForSubtype(form.subtype);

  const showLogisticsTab = showSandQuarryFields || showSandDemandField || showPadEarthworkSection;

  const showFootprintLineConnectionsSection =
    selection.kind === 'infra' &&
    isEarthworkEligibleSubtype(form.subtype) &&
    !isBottomholeSubtype(form.subtype) &&
    !isLine;

  const displayName = isPoi
    ? (form.poiForm?.name ?? (selection.kind === 'poi' ? selection.poi.name : 'Объект'))
    : form.name || 'Объект';

  const setDisplayName = (value: string) => {
    if (isPoi && form.poiForm) {
      form.setPoiForm({ ...form.poiForm, name: value });
      return;
    }
    form.setName(value);
  };

  return {
    isPoi,
    infraObject,
    infraDirtyDraft,
    render3dModelOptions,
    isLine,
    isBottomhole,
    linkedBottomholePad,
    lineCoords,
    lineLengthLabel,
    lineLengthFromProfile,
    subtypeLabel,
    layerName,
    sparkType,
    infraSubtypeOptions,
    subtypeLocked,
    showThroughputCapacity,
    showSandQuarryFields,
    showSandDemandField,
    showPadEarthworkSection,
    showTrajectoriesSection,
    showProfileTab,
    showPadWellCountField,
    padWellCount: effectivePadWellCount,
    padWellCountDerivedFromBottomholes,
    linkedBottomholesCount: linkedBottomholes.length,
    sandLogistics,
    infraObjectId,
    showEntryDateField,
    quarryVolumeWarning,
    throughputCapacity,
    isDirty,
    capacityUnit,
    showLogisticsTab,
    showFootprintLineConnectionsSection,
    mapProjectId: resolvedMapProjectId,
    displayName,
    setDisplayName,
  };
}
