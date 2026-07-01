import { useCallback, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { defaultProjectsMapSettingsApi } from '../../lib/api';
import { iconDataUrl } from '../../lib/mapIcons';
import { useAppStore } from '../../store';
import type { ObjectDetailPanelProps } from './types';
import { useObjectDetailFormState } from './useObjectDetailFormState';
import { useObjectDetailInfraDerived } from './useObjectDetailInfraDerived';
import { useObjectDetailPanelTabs } from './useObjectDetailPanelTabs';
import { useObjectDetailPanelKeyboard } from './useObjectDetailPanelKeyboard';
import { buildDetailPanelSaveHandler } from './detailPanelSave';
import { copyCoordinates as copyCoordinatesToClipboard, copyTextToClipboard } from './copyCoordinates';
import type { PadEarthworkDetailBridge } from './padEarthworkDetailBridge';

export function useObjectDetailPanel({
  selection,
  layers,
  map3dCustomModels = [],
  infraObjects = [],
  onSave,
  onClose,
  readOnly = false,
  saving: _saving,
}: Pick<
  ObjectDetailPanelProps,
  | 'selection'
  | 'layers'
  | 'map3dCustomModels'
  | 'infraObjects'
  | 'onSave'
  | 'onClose'
  | 'readOnly'
  | 'saving'
>) {
  const pushToast = useAppStore((s) => s.pushToast);
  const form = useObjectDetailFormState(selection, map3dCustomModels, infraObjects);

  const projectId = selection.kind === 'poi' ? selection.poi.project_id : null;
  const { data: defaults } = useQuery({
    queryKey: ['distanceDefaults', projectId],
    queryFn: () => defaultProjectsMapSettingsApi.getDistanceDefaults(projectId!),
    enabled: !!projectId,
    retry: false,
  });

  const derived = useObjectDetailInfraDerived({ selection, layers, map3dCustomModels, infraObjects, form });

  const padEarthworkBridgeRef = useRef<PadEarthworkDetailBridge | null>(null);
  const [padParamsDirty, setPadParamsDirty] = useState(false);

  const onPadEarthworkBridgeChange = useCallback((bridge: PadEarthworkDetailBridge | null) => {
    padEarthworkBridgeRef.current = bridge;
    setPadParamsDirty(bridge?.isParamsDirty ?? false);
  }, []);

  const isDirty = derived.isDirty || padParamsDirty;

  const handleSave = useCallback(async () => {
    if (readOnly) return;
    try {
      const patchedInfra = await padEarthworkBridgeRef.current?.saveParamsIfDirty();

      if (derived.isDirty) {
        const selectionForSave =
          selection.kind === 'infra' && patchedInfra
            ? { kind: 'infra' as const, object: patchedInfra }
            : selection;
        buildDetailPanelSaveHandler({
          readOnly,
          isPoi: derived.isPoi,
          poiForm: form.poiForm,
          selection: selectionForSave,
          infraDirtyDraft: derived.infraDirtyDraft,
          name: form.name,
          description: form.description,
          subtype: form.subtype,
          layerId: form.layerId,
          lon: form.lon,
          lat: form.lat,
          onSave,
        })();
      } else if (patchedInfra) {
        const label = patchedInfra.name;
        pushToast('success', label ? `Сохранено: «${label}»` : 'Изменения сохранены');
      }
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Не удалось сохранить параметры площадки');
    }
  }, [
      readOnly,
      derived.isDirty,
      derived.isPoi,
      derived.infraDirtyDraft,
      form.poiForm,
      selection,
      form.name,
      form.description,
      form.subtype,
      form.layerId,
      form.lon,
      form.lat,
      onSave,
      pushToast,
    ]);

  useObjectDetailPanelKeyboard({ onClose, readOnly, handleSave });

  const tabs = useObjectDetailPanelTabs({
    readOnly,
    showLogisticsTab: derived.showLogisticsTab,
    showTrajectoriesTab: derived.showTrajectoriesSection,
    showProfileTab: derived.showProfileTab,
    infraTab: form.infraTab,
    setInfraTab: form.setInfraTab,
    poiTab: form.poiTab,
    isPoi: derived.isPoi,
    poiForm: form.poiForm,
    selection,
    infraObject: derived.infraObject,
    infraDirtyDraft: derived.infraDirtyDraft,
    map3dCustomModels,
    isLine: derived.isLine,
  });

  const copyCoordinates = () =>
    copyCoordinatesToClipboard(form.lon, form.lat, pushToast);

  const copyCoordinatesText = (text: string) => copyTextToClipboard(text, pushToast);

  const headerIcon = derived.isPoi ? iconDataUrl('poi') : iconDataUrl(form.subtype);

  return {
    defaults,
    ...form,
    ...derived,
    isDirty,
    ...tabs,
    handleSave,
    onPadEarthworkBridgeChange,
    copyCoordinates,
    copyCoordinatesText,
    headerIcon,
  };
}
