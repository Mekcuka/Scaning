import { useCallback, useEffect, useMemo } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  INFRA_TAB_ICONS,
  POI_TAB_ICONS,
  POI_TAB_LABELS,
  type InfraDetailTab,
  type PoiDetailTab,
} from './constants';
import {
  computeInfraTabDirty,
  computePoiTabDirty,
  type InfraDirtyDraft,
} from './detailDirty';
import type { InfraObject, Map3dCustomModel } from '../../lib/api';
import type { PoiFormValues } from '../../lib/poiParams';
import type { SelectedFeature } from './types';

export function useObjectDetailPanelTabs(params: {
  readOnly: boolean;
  showLogisticsTab: boolean;
  infraTab: InfraDetailTab;
  setInfraTab: (tab: InfraDetailTab) => void;
  poiTab: PoiDetailTab;
  isPoi: boolean;
  poiForm: PoiFormValues | null;
  selection: SelectedFeature;
  infraObject: InfraObject | null;
  infraDirtyDraft: InfraDirtyDraft;
  map3dCustomModels: Map3dCustomModel[];
  isLine: boolean;
}) {
  const {
    readOnly,
    showLogisticsTab,
    infraTab,
    setInfraTab,
    isPoi,
    poiForm,
    selection,
    infraObject,
    infraDirtyDraft,
    map3dCustomModels,
    isLine,
  } = params;

  const infraTabs = useMemo(() => {
    const tabs: { id: InfraDetailTab; label: string; icon: LucideIcon }[] = [
      { id: 'main', label: 'Основное', icon: INFRA_TAB_ICONS.main },
    ];
    if (showLogisticsTab) {
      tabs.push({ id: 'logistics', label: 'Логистика', icon: INFRA_TAB_ICONS.logistics });
    }
    tabs.push({ id: 'extra', label: '3D', icon: INFRA_TAB_ICONS.extra });
    return tabs;
  }, [showLogisticsTab]);

  useEffect(() => {
    if (!infraTabs.some((t) => t.id === infraTab)) {
      setInfraTab('main');
    }
  }, [infraTabs, infraTab, setInfraTab]);

  const poiTabs = useMemo(
    () =>
      (['basic', 'engineering', 'calculation'] as const).map((id) => ({
        id,
        label: POI_TAB_LABELS[id],
        icon: POI_TAB_ICONS[id],
      })),
    [],
  );

  const infraTabDirty = useCallback(
    (tab: InfraDetailTab): boolean => {
      if (readOnly || !infraObject) return false;
      return computeInfraTabDirty(tab, infraObject, infraDirtyDraft, map3dCustomModels, isLine);
    },
    [readOnly, infraObject, infraDirtyDraft, map3dCustomModels, isLine],
  );

  const poiTabDirty = useCallback(
    (tab: PoiDetailTab): boolean => {
      if (readOnly || !isPoi || !poiForm || selection.kind !== 'poi') return false;
      return computePoiTabDirty(tab, poiForm, selection.poi);
    },
    [readOnly, isPoi, poiForm, selection],
  );

  return { infraTabs, poiTabs, infraTabDirty, poiTabDirty };
}
