import { useCallback } from 'react';
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
import { copyCoordinates as copyCoordinatesToClipboard } from './copyCoordinates';

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
  const form = useObjectDetailFormState(selection, map3dCustomModels);

  const projectId = selection.kind === 'poi' ? selection.poi.project_id : null;
  const { data: defaults } = useQuery({
    queryKey: ['distanceDefaults', projectId],
    queryFn: () => defaultProjectsMapSettingsApi.getDistanceDefaults(projectId!),
    enabled: !!projectId,
    retry: false,
  });

  const derived = useObjectDetailInfraDerived({ selection, layers, map3dCustomModels, infraObjects, form });

  const handleSave = useCallback(() => {
    buildDetailPanelSaveHandler({
      readOnly,
      isPoi: derived.isPoi,
      poiForm: form.poiForm,
      selection,
      infraDirtyDraft: derived.infraDirtyDraft,
      name: form.name,
      description: form.description,
      subtype: form.subtype,
      layerId: form.layerId,
      lon: form.lon,
      lat: form.lat,
      onSave,
    })();
  }, [
      readOnly,
      derived.isPoi,
      form.poiForm,
      selection,
      derived.infraDirtyDraft,
      form.name,
      form.description,
      form.subtype,
      form.layerId,
      form.lon,
      form.lat,
      onSave,
    ]);

  useObjectDetailPanelKeyboard({ onClose, readOnly, handleSave });

  const tabs = useObjectDetailPanelTabs({
    readOnly,
    showLogisticsTab: derived.showLogisticsTab,
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

  const headerIcon = derived.isPoi ? iconDataUrl('poi') : iconDataUrl(form.subtype);

  return {
    defaults,
    ...form,
    ...derived,
    ...tabs,
    handleSave,
    copyCoordinates,
    headerIcon,
  };
}
