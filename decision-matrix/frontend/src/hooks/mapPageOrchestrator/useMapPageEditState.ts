import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type DrawMode,
  type MapFeatureSelection,
  type MapFocusTarget,
  type SelectMode,
} from '../../components/MapView';
import { emptyPoiFormValues } from '../../lib/poiParams';
import type { MapClipboardItem } from '../../lib/mapClipboard';

export function useMapPageEditState(
  canEditMap: boolean,
  canWriteProject: boolean,
  canWriteInfra: boolean,
) {
  const lineHealSkipIdsRef = useRef<Set<string>>(new Set());
  const clearLineDraftRef = useRef<() => void>(() => {});
  const clearDrawingForModeSwitchRef = useRef<() => void>(() => {});

  const [cursor, setCursor] = useState<{ lon: number; lat: number } | null>(null);
  const cursorRef = useRef<{ lon: number; lat: number } | null>(null);
  const [mapPointerInside, setMapPointerInside] = useState(false);
  const [drawMode, setDrawMode] = useState<DrawMode>('select');
  const [selectMode, setSelectMode] = useState<SelectMode>('single');
  const [selectedPoiId, setSelectedPoiId] = useState<string | null>(null);
  const [modal, setModal] = useState<null | { type: 'poi'; lon: number; lat: number }>(null);
  const [poiForm, setPoiForm] = useState(emptyPoiFormValues);
  const [infraForm, setInfraForm] = useState({ subtype: 'gas_processing' });
  const [searchQ, setSearchQ] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [featureSel, setFeatureSel] = useState<MapFeatureSelection | null>(null);
  const [featureGroupSel, setFeatureGroupSel] = useState<MapFeatureSelection[]>([]);
  const [candidateSubtype, setCandidateSubtype] = useState<string | null>(null);
  const [candidateParamType, setCandidateParamType] = useState<'external' | 'external_linear'>(
    'external',
  );
  const [pointMenuOpen, setPointMenuOpen] = useState(false);
  const [lineMenuOpen, setLineMenuOpen] = useState(false);
  const [mapFocus, setMapFocus] = useState<MapFocusTarget | null>(null);
  const [mapEditEnabled, setMapEditEnabled] = useState(false);
  const [mapClipboard, setMapClipboard] = useState<MapClipboardItem[] | null>(null);
  const [pasteMode, setPasteMode] = useState(false);
  const [footprintLineConnectPickSubtype, setFootprintLineConnectPickSubtype] =
    useState<string | null>(null);

  useEffect(() => {
    setFootprintLineConnectPickSubtype(null);
  }, [featureSel?.id, featureSel?.kind]);

  useEffect(() => {
    if (!canEditMap) {
      setMapEditEnabled(false);
      setDrawMode('select');
      setPointMenuOpen(false);
      setLineMenuOpen(false);
    }
  }, [canEditMap]);

  useEffect(() => {
    if (!canWriteProject && drawMode === 'poi') setDrawMode('select');
    if (
      !canWriteInfra &&
      (drawMode === 'point' || drawMode === 'line' || drawMode === 'autoroad_network')
    ) {
      setDrawMode('select');
    }
  }, [canWriteProject, canWriteInfra, drawMode]);

  useEffect(() => {
    if (drawMode !== 'select') {
      setFeatureSel(null);
      setFeatureGroupSel([]);
      setPasteMode(false);
    }
  }, [drawMode]);

  useEffect(() => {
    if (selectMode === 'single') setFeatureGroupSel([]);
    else setFeatureSel(null);
  }, [selectMode]);

  useEffect(() => {
    if (mapEditEnabled) {
      return;
    }
    setFeatureSel(null);
    setFeatureGroupSel([]);
    setPasteMode(false);
    setDrawMode((m) => (m === 'ruler' ? m : 'select'));
    clearLineDraftRef.current();
    setPointMenuOpen(false);
    setLineMenuOpen(false);
  }, [mapEditEnabled]);

  const cancelDrawingSelection = useCallback(() => {
    setDrawMode('select');
    clearLineDraftRef.current();
    setPointMenuOpen(false);
    setLineMenuOpen(false);
  }, []);

  return {
    lineHealSkipIdsRef,
    clearLineDraftRef,
    clearDrawingForModeSwitchRef,
    cursor,
    setCursor,
    cursorRef,
    mapPointerInside,
    setMapPointerInside,
    drawMode,
    setDrawMode,
    selectMode,
    setSelectMode,
    selectedPoiId,
    setSelectedPoiId,
    modal,
    setModal,
    poiForm,
    setPoiForm,
    infraForm,
    setInfraForm,
    searchQ,
    setSearchQ,
    searchOpen,
    setSearchOpen,
    featureSel,
    setFeatureSel,
    featureGroupSel,
    setFeatureGroupSel,
    candidateSubtype,
    setCandidateSubtype,
    candidateParamType,
    setCandidateParamType,
    pointMenuOpen,
    setPointMenuOpen,
    lineMenuOpen,
    setLineMenuOpen,
    mapFocus,
    setMapFocus,
    mapEditEnabled,
    setMapEditEnabled,
    mapClipboard,
    setMapClipboard,
    pasteMode,
    setPasteMode,
    footprintLineConnectPickSubtype,
    setFootprintLineConnectPickSubtype,
    cancelDrawingSelection,
  };
}
