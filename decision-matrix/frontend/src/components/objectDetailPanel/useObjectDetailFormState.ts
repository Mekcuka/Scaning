import { useCallback, useEffect, useRef, useState } from 'react';
import type { InfraObject, Map3dCustomModel } from '../../lib/api';
import type { PoiFormValues } from '../../lib/poiParams';
import { DEFAULT_RENDER_3D_SCALE } from '../../lib/map3d/render3d';
import type { SandVolumeInputMode } from '../../lib/infraSandVolumes';
import type { InfraDetailTab, PoiDetailTab } from './constants';
import { createInfraFormDraftFromObject, createPoiFormFromSelection } from './formState';
import { readPointFootprintLineConnections } from '../../lib/padFootprintLineAttach';
import type { SelectedFeature } from './types';
import {
  bottomholeFormFieldsFromInfraObject,
  EMPTY_BOTTOMHOLE_FORM_FIELDS,
  mergeBottomholeFormFields,
  type BottomholeFormFields,
} from './bottomholeFormFields';
import {
  isBottomholeSubtype,
  readBottomholeLinkedPadId,
  WELL_BOTTOMHOLE_HEEL_TVD_M,
  WELL_BOTTOMHOLE_LINKED_PAD_ID,
  WELL_BOTTOMHOLE_TOE_TVD_M,
  WELL_BOTTOMHOLE_TVD_M,
} from '../../lib/wellBottomholeProperties';
import {
  formatBottomholeElevation,
  readGsLineBottomholeElevations,
  readPointBottomholeElevation,
} from '../../lib/wellBottomholeElevation';

function selectionSyncKey(selection: SelectedFeature): string {
  return selection.kind === 'poi'
    ? `poi:${selection.poi.id}`
    : `infra:${selection.object.id}`;
}

export function useObjectDetailFormState(
  selection: SelectedFeature,
  map3dCustomModels: Map3dCustomModel[],
  infraObjects: InfraObject[] = [],
) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [subtype, setSubtype] = useState('');
  const [layerId, setLayerId] = useState('');
  const [lon, setLon] = useState('');
  const [lat, setLat] = useState('');
  const [endLon, setEndLon] = useState('');
  const [endLat, setEndLat] = useState('');
  const [z, setZ] = useState('');
  const [zHeel, setZHeel] = useState('');
  const [zToe, setZToe] = useState('');
  const [poiForm, setPoiForm] = useState<PoiFormValues | null>(null);
  const [sandInitialM3, setSandInitialM3] = useState('');
  const [sandCurrentM3, setSandCurrentM3] = useState('');
  const [sandDemandM3, setSandDemandM3] = useState('');
  const [sandVolumeByYear, setSandVolumeByYear] = useState<Record<string, number>>({});
  const [sandVolumeMode, setSandVolumeMode] = useState<SandVolumeInputMode>('single');
  const [entryDate, setEntryDate] = useState('');
  const [capacityValue, setCapacityValue] = useState<number | ''>('');
  const [render3dHeight, setRender3dHeight] = useState('');
  const [render3dDiameter, setRender3dDiameter] = useState('');
  const [render3dBase, setRender3dBase] = useState('');
  const [render3dScale, setRender3dScale] = useState(String(DEFAULT_RENDER_3D_SCALE));
  const [render3dVisible, setRender3dVisible] = useState(true);
  const [render3dStyle, setRender3dStyle] = useState('');
  const [render3dModelId, setRender3dModelId] = useState('');
  const [padWellCount, setPadWellCount] = useState('');
  const [padWellsPerGroup, setPadWellsPerGroup] = useState('');
  const [padWellSpacingM, setPadWellSpacingM] = useState('');
  const [padGroupSpacingM, setPadGroupSpacingM] = useState('');
  const [padMarginLeftM, setPadMarginLeftM] = useState('');
  const [padMarginBottomM, setPadMarginBottomM] = useState('');
  const [padMarginTopM, setPadMarginTopM] = useState('');
  const [padMarginEndM, setPadMarginEndM] = useState('');
  const [pointFootprintLineConnections, setPointFootprintLineConnections] = useState<
    import('../../lib/padFootprintLineAttach').PointFootprintLineConnections
  >({});
  const [lineProfileStepM, setLineProfileStepM] = useState('');
  const [infraTab, setInfraTab] = useState<InfraDetailTab>('main');
  const [poiTab, setPoiTab] = useState<PoiDetailTab>('basic');
  const [bottomholeFields, setBottomholeFields] = useState<BottomholeFormFields>(
    EMPTY_BOTTOMHOLE_FORM_FIELDS,
  );
  const selectionKeyRef = useRef('');
  const infraObjectsRef = useRef(infraObjects);
  infraObjectsRef.current = infraObjects;

  const syncKey = selectionSyncKey(selection);
  const infraPropsSnapshot =
    selection.kind === 'infra' ? JSON.stringify(selection.object.properties ?? {}) : '';

  useEffect(() => {
    if (selection.kind === 'poi') {
      const key = selectionSyncKey(selection);
      const isNewSelection = selectionKeyRef.current !== key;
      selectionKeyRef.current = key;
      if (isNewSelection) {
        setPoiForm(createPoiFormFromSelection(selection.poi));
        setPoiTab('basic');
      }
      return;
    }
    const key = selectionSyncKey(selection);
    const isNewSelection = selectionKeyRef.current !== key;
    selectionKeyRef.current = key;
    if (!isNewSelection) return;
    const draft = createInfraFormDraftFromObject(
      selection.object,
      map3dCustomModels,
      infraObjectsRef.current,
    );
    setName(draft.name);
    setDescription(draft.description);
    setSubtype(draft.subtype);
    setLayerId(draft.layerId);
    setLon(draft.lon);
    setLat(draft.lat);
    setEndLon(draft.endLon);
    setEndLat(draft.endLat);
    setZ(draft.z);
    setZHeel(draft.zHeel);
    setZToe(draft.zToe);
    setPoiForm(null);
    setSandInitialM3(draft.sandInitialM3);
    setSandCurrentM3(draft.sandCurrentM3);
    setSandDemandM3(draft.sandDemandM3);
    setSandVolumeByYear(draft.sandVolumeByYear);
    setSandVolumeMode(draft.sandVolumeMode);
    setEntryDate(draft.entryDate);
    setCapacityValue(draft.capacityValue);
    setRender3dHeight(draft.render3dHeight);
    setRender3dDiameter(draft.render3dDiameter);
    setRender3dBase(draft.render3dBase);
    setRender3dScale(draft.render3dScale);
    setRender3dVisible(draft.render3dVisible);
    setRender3dStyle(draft.render3dStyle);
    setRender3dModelId(draft.render3dModelId);
    setPadWellCount(draft.padWellCount);
    setPadWellsPerGroup(draft.padWellsPerGroup);
    setPadWellSpacingM(draft.padWellSpacingM);
    setPadGroupSpacingM(draft.padGroupSpacingM);
    setPadMarginLeftM(draft.padMarginLeftM);
    setPadMarginBottomM(draft.padMarginBottomM);
    setPadMarginTopM(draft.padMarginTopM);
    setPadMarginEndM(draft.padMarginEndM);
    setPointFootprintLineConnections(draft.pointFootprintLineConnections);
    setLineProfileStepM(draft.lineProfileStepM);
    setBottomholeFields(
      isBottomholeSubtype(selection.object.subtype)
        ? bottomholeFormFieldsFromInfraObject(selection.object)
        : EMPTY_BOTTOMHOLE_FORM_FIELDS,
    );
    setInfraTab(draft.infraTab);
    setPoiTab(draft.poiTab);
  }, [syncKey, map3dCustomModels, selection]);

  /** После сохранения / refetch — подтянуть 3D-поля с сервера (тот же объект). */
  useEffect(() => {
    if (selection.kind !== 'infra') return;
    const draft = createInfraFormDraftFromObject(
      selection.object,
      map3dCustomModels,
      infraObjectsRef.current,
    );
    setRender3dHeight(draft.render3dHeight);
    setRender3dDiameter(draft.render3dDiameter);
    setRender3dBase(draft.render3dBase);
    setRender3dScale(draft.render3dScale);
    setRender3dVisible(draft.render3dVisible);
    setRender3dStyle(draft.render3dStyle);
    setRender3dModelId(draft.render3dModelId);
    setLineProfileStepM(draft.lineProfileStepM);
  }, [infraPropsSnapshot, map3dCustomModels, selection]);

  useEffect(() => {
    if (selection.kind !== 'infra') return;
    const obj = selection.object;
    if (!isBottomholeSubtype(obj.subtype)) return;
    const mergedProps = {
      ...(obj.properties ?? {}),
      ...(bottomholeFields.linkedPadId
        ? { [WELL_BOTTOMHOLE_LINKED_PAD_ID]: bottomholeFields.linkedPadId }
        : {}),
      ...(bottomholeFields.heelTvdM.trim()
        ? { [WELL_BOTTOMHOLE_HEEL_TVD_M]: Number(bottomholeFields.heelTvdM) }
        : {}),
      ...(bottomholeFields.toeTvdM.trim()
        ? { [WELL_BOTTOMHOLE_TOE_TVD_M]: Number(bottomholeFields.toeTvdM) }
        : {}),
      ...(bottomholeFields.tvdM.trim()
        ? { [WELL_BOTTOMHOLE_TVD_M]: Number(bottomholeFields.tvdM) }
        : {}),
    };
    const padId = readBottomholeLinkedPadId(mergedProps);
    const pad = padId ? (infraObjects.find((p) => p.id === padId) ?? null) : null;
    const merged = { ...obj, properties: mergedProps };
    if (obj.subtype === 'well_bottomhole_gs') {
      const { heelZ, toeZ } = readGsLineBottomholeElevations(merged, pad);
      setZHeel(formatBottomholeElevation(heelZ));
      setZToe(formatBottomholeElevation(toeZ));
      return;
    }
    setZ(formatBottomholeElevation(readPointBottomholeElevation(merged, pad)));
  }, [bottomholeFields, selection, infraObjects]);

  const patchBottomholeFields = useCallback((patch: Partial<BottomholeFormFields>) => {
    setBottomholeFields((prev) => mergeBottomholeFormFields(prev, patch));
  }, []);

  const infraFootprintSelection = selection.kind === 'infra' ? selection.object : null;
  const infraFootprintConnectionsKey = infraFootprintSelection
    ? JSON.stringify(infraFootprintSelection.properties?.footprint_line_connections ?? null)
    : null;

  useEffect(() => {
    if (!infraFootprintSelection) return;
    setPointFootprintLineConnections(
      readPointFootprintLineConnections(infraFootprintSelection.properties),
    );
  }, [infraFootprintSelection, infraFootprintConnectionsKey]);

  return {
    name,
    setName,
    description,
    setDescription,
    subtype,
    setSubtype,
    layerId,
    setLayerId,
    lon,
    setLon,
    lat,
    setLat,
    endLon,
    setEndLon,
    endLat,
    setEndLat,
    z,
    setZ,
    zHeel,
    setZHeel,
    zToe,
    setZToe,
    poiForm,
    setPoiForm,
    sandInitialM3,
    setSandInitialM3,
    sandCurrentM3,
    setSandCurrentM3,
    sandDemandM3,
    setSandDemandM3,
    sandVolumeByYear,
    setSandVolumeByYear,
    sandVolumeMode,
    setSandVolumeMode,
    entryDate,
    setEntryDate,
    capacityValue,
    setCapacityValue,
    render3dHeight,
    setRender3dHeight,
    render3dDiameter,
    setRender3dDiameter,
    render3dBase,
    setRender3dBase,
    render3dScale,
    setRender3dScale,
    render3dVisible,
    setRender3dVisible,
    render3dStyle,
    setRender3dStyle,
    render3dModelId,
    setRender3dModelId,
    padWellCount,
    setPadWellCount,
    padWellsPerGroup,
    setPadWellsPerGroup,
    padWellSpacingM,
    setPadWellSpacingM,
    padGroupSpacingM,
    setPadGroupSpacingM,
    padMarginLeftM,
    setPadMarginLeftM,
    padMarginBottomM,
    setPadMarginBottomM,
    padMarginTopM,
    setPadMarginTopM,
    padMarginEndM,
    setPadMarginEndM,
    pointFootprintLineConnections,
    setPointFootprintLineConnections,
    lineProfileStepM,
    setLineProfileStepM,
    infraTab,
    setInfraTab,
    poiTab,
    setPoiTab,
    bottomholeFields,
    setBottomholeFields,
    patchBottomholeFields,
  };
}
