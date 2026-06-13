import { useEffect, useRef, useState } from 'react';
import type { Map3dCustomModel } from '../../lib/api';
import type { PoiFormValues } from '../../lib/poiParams';
import { DEFAULT_RENDER_3D_SCALE } from '../../lib/map3d/render3d';
import type { SandVolumeInputMode } from '../../lib/infraSandVolumes';
import type { InfraDetailTab, PoiDetailTab } from './constants';
import { createInfraFormDraftFromObject, createPoiFormFromSelection } from './formState';
import { readPointFootprintLineConnections } from '../../lib/padFootprintLineAttach';
import type { SelectedFeature } from './types';
import {
  WELL_BOTTOMHOLE_GS_HEEL_ID,
  WELL_BOTTOMHOLE_LINKED_PAD_ID,
  WELL_BOTTOMHOLE_TARGET_AZI,
  WELL_BOTTOMHOLE_TARGET_INC,
  WELL_BOTTOMHOLE_TVD_M,
  WELL_BOTTOMHOLE_WELL_INDEX,
} from '../../lib/wellBottomholeProperties';

const BOTTOMHOLE_PROP_KEYS = [
  WELL_BOTTOMHOLE_LINKED_PAD_ID,
  WELL_BOTTOMHOLE_WELL_INDEX,
  WELL_BOTTOMHOLE_TVD_M,
  WELL_BOTTOMHOLE_TARGET_INC,
  WELL_BOTTOMHOLE_TARGET_AZI,
  WELL_BOTTOMHOLE_GS_HEEL_ID,
] as const;

export function pickBottomholePropsPatch(
  props: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!props) return out;
  for (const key of BOTTOMHOLE_PROP_KEYS) {
    if (props[key] !== undefined) out[key] = props[key];
  }
  return out;
}

export function useObjectDetailFormState(
  selection: SelectedFeature,
  map3dCustomModels: Map3dCustomModel[],
) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [subtype, setSubtype] = useState('');
  const [layerId, setLayerId] = useState('');
  const [lon, setLon] = useState('');
  const [lat, setLat] = useState('');
  const [poiForm, setPoiForm] = useState<PoiFormValues | null>(null);
  const [sandInitialM3, setSandInitialM3] = useState('');
  const [sandCurrentM3, setSandCurrentM3] = useState('');
  const [sandDemandM3, setSandDemandM3] = useState('');
  const [sandVolumeByYear, setSandVolumeByYear] = useState<Record<string, number>>({});
  const [sandVolumeMode, setSandVolumeMode] = useState<SandVolumeInputMode>('single');
  const [entryDate, setEntryDate] = useState('');
  const [capacityValue, setCapacityValue] = useState<number | ''>('');
  const [render3dHeight, setRender3dHeight] = useState('');
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
  const [infraTab, setInfraTab] = useState<InfraDetailTab>('main');
  const [poiTab, setPoiTab] = useState<PoiDetailTab>('basic');
  const [bottomholePropsPatch, setBottomholePropsPatch] = useState<Record<string, unknown>>({});
  const selectionKeyRef = useRef('');

  useEffect(() => {
    if (selection.kind === 'poi') {
      const key = `poi:${selection.poi.id}`;
      const isNewSelection = selectionKeyRef.current !== key;
      selectionKeyRef.current = key;
      if (isNewSelection) {
        setPoiForm(createPoiFormFromSelection(selection.poi));
        setPoiTab('basic');
      }
      return;
    }
    const key = `infra:${selection.object.id}`;
    const isNewSelection = selectionKeyRef.current !== key;
    selectionKeyRef.current = key;
    if (!isNewSelection) return;
    const draft = createInfraFormDraftFromObject(selection.object, map3dCustomModels);
    setName(draft.name);
    setDescription(draft.description);
    setSubtype(draft.subtype);
    setLayerId(draft.layerId);
    setLon(draft.lon);
    setLat(draft.lat);
    setPoiForm(null);
    setSandInitialM3(draft.sandInitialM3);
    setSandCurrentM3(draft.sandCurrentM3);
    setSandDemandM3(draft.sandDemandM3);
    setSandVolumeByYear(draft.sandVolumeByYear);
    setSandVolumeMode(draft.sandVolumeMode);
    setEntryDate(draft.entryDate);
    setCapacityValue(draft.capacityValue);
    setRender3dHeight(draft.render3dHeight);
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
    setBottomholePropsPatch({});
    setInfraTab(draft.infraTab);
    setPoiTab(draft.poiTab);
  }, [selection, map3dCustomModels]);

  useEffect(() => {
    if (selection.kind !== 'infra') return;
    setPointFootprintLineConnections(readPointFootprintLineConnections(selection.object.properties));
  }, [
    selection.kind,
    selection.kind === 'infra' ? selection.object.id : null,
    selection.kind === 'infra'
      ? JSON.stringify(selection.object.properties?.footprint_line_connections ?? null)
      : null,
  ]);

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
    infraTab,
    setInfraTab,
    poiTab,
    setPoiTab,
    bottomholePropsPatch,
    setBottomholePropsPatch,
  };
}
