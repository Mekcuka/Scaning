import { useEffect, useState } from 'react';
import type { Map3dCustomModel } from '../../lib/api';
import type { PoiFormValues } from '../../lib/poiParams';
import { DEFAULT_RENDER_3D_SCALE } from '../../lib/map3d/render3d';
import type { SandVolumeInputMode } from '../../lib/infraSandVolumes';
import type { InfraDetailTab, PoiDetailTab } from './constants';
import { createInfraFormDraftFromObject, createPoiFormFromSelection } from './formState';
import type { SelectedFeature } from './types';

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
  const [infraTab, setInfraTab] = useState<InfraDetailTab>('main');
  const [poiTab, setPoiTab] = useState<PoiDetailTab>('basic');

  useEffect(() => {
    if (selection.kind === 'poi') {
      setPoiForm(createPoiFormFromSelection(selection.poi));
      return;
    }
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
    setInfraTab(draft.infraTab);
    setPoiTab(draft.poiTab);
  }, [selection, map3dCustomModels]);

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
    infraTab,
    setInfraTab,
    poiTab,
    setPoiTab,
  };
}
