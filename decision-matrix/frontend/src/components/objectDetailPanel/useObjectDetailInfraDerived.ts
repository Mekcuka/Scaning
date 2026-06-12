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
import { isPadSubtype } from '../../lib/infraPadEarthwork';
import { pointShowsPadWellFields } from '../../lib/infraPadWells';
import {
  isSandQuarrySubtype,
  pointShowsSandDemand,
} from '../../lib/infraSandVolumes';
import { objectShowsEntryDate } from '../../lib/infraEntryDate';
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
  form: FormState;
}) {
  const { selection, layers, map3dCustomModels, form } = params;

  const isPoi = selection.kind === 'poi';
  const infraObject: InfraObject | null = selection.kind === 'infra' ? selection.object : null;

  const infraDirtyDraft = useMemo<InfraDirtyDraft>(
    () => ({
      name: form.name,
      description: form.description,
      subtype: form.subtype,
      layerId: form.layerId,
      lon: form.lon,
      lat: form.lat,
      sandInitialM3: form.sandInitialM3,
      sandCurrentM3: form.sandCurrentM3,
      sandDemandM3: form.sandDemandM3,
      sandVolumeByYear: form.sandVolumeByYear,
      sandVolumeMode: form.sandVolumeMode,
      entryDate: form.entryDate,
      capacityValue: form.capacityValue,
      render3dHeight: form.render3dHeight,
      render3dBase: form.render3dBase,
      render3dScale: form.render3dScale,
      render3dVisible: form.render3dVisible,
      render3dStyle: form.render3dStyle,
      render3dModelId: form.render3dModelId,
      padWellCount: form.padWellCount,
      padWellsPerGroup: form.padWellsPerGroup,
      padWellSpacingM: form.padWellSpacingM,
      padGroupSpacingM: form.padGroupSpacingM,
      padMarginLeftM: form.padMarginLeftM,
      padMarginBottomM: form.padMarginBottomM,
      padMarginTopM: form.padMarginTopM,
      padMarginEndM: form.padMarginEndM,
    }),
    [form],
  );

  const render3dModelOptions = useMemo(() => {
    if (!infraObject) return [];
    return buildRender3dModelOptions(infraObject.subtype, map3dCustomModels);
  }, [infraObject, map3dCustomModels]);

  const isLine = infraObject != null && isLineSubtype(infraObject.subtype);
  const lineCoords = infraObject
    ? (getLineCoordinates(infraObject) as [number, number][] | null)
    : null;
  const lineLengthLabel =
    lineCoords && lineCoords.length >= 2
      ? formatLengthMeters(lineLengthMeters(lineCoords))
      : null;

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
    selection.kind === 'infra' && isPadSubtype(form.subtype) && !isLine;
  const showPadWellCountField =
    selection.kind === 'infra' && pointShowsPadWellFields(form.subtype) && !isLine;

  const { projectId: mapProjectId } = useActiveProject();
  const resolvedMapProjectId = mapProjectId ?? null;
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
    lineCoords,
    lineLengthLabel,
    subtypeLabel,
    layerName,
    sparkType,
    infraSubtypeOptions,
    subtypeLocked,
    showThroughputCapacity,
    showSandQuarryFields,
    showSandDemandField,
    showPadEarthworkSection,
    showPadWellCountField,
    sandLogistics,
    infraObjectId,
    showEntryDateField,
    quarryVolumeWarning,
    throughputCapacity,
    isDirty,
    capacityUnit,
    showLogisticsTab,
    mapProjectId: resolvedMapProjectId,
    displayName,
    setDisplayName,
  };
}
