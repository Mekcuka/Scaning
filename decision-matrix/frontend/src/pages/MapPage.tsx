import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BoxSelect, MapPin, Minus, MousePointer2, Network, Pencil, Search, Trash2, X, Zap } from 'lucide-react';
import { CandidatesModal } from '../components/CandidatesModal';
import { LayerPanel } from '../components/LayerPanel';
import { ObjectDetailPanel, type SelectedFeature } from '../components/ObjectDetailPanel';
import { PoiParamsForm } from '../components/PoiParamsForm';
import { formatCoord, formatCoordPair, parseCoord, roundCoord } from '../lib/coords';
import { emptyPoiFormValues, formValuesToPoiCreatePayload } from '../lib/poiParams';
import { MapView, type DrawMode, type MapFeatureSelection, type SelectMode, type ThresholdCircle } from '../components/MapView';
import { iconDataUrl } from '../lib/mapIcons';
import {
  LINE_SUBTYPES,
  POINT_SUBTYPES,
  SUBTYPE_LABELS,
  api,
  type AnalysisRow,
  type Candidate,
  type InfraObject,
  type POI,
} from '../lib/api';
import { useActiveProject } from '../hooks/useActiveProject';
import { refreshMapQueries } from '../lib/mapQueries';
import { useAppStore } from '../store';

const THRESHOLD_META: { subtype: string; color: string; label: string; defaultKm: number }[] = [
  { subtype: 'gas_processing', color: '#ff6f00', label: 'ГКС', defaultKm: 80 },
  { subtype: 'gtes', color: '#d84315', label: 'ГТЭС', defaultKm: 60 },
  { subtype: 'substation', color: '#f9a825', label: 'ПС/ТП', defaultKm: 25 },
  { subtype: 'refinery', color: '#455a64', label: 'НПЗ', defaultKm: 100 },
];

export function MapPage() {
  const { projectId } = useActiveProject();
  const queryClient = useQueryClient();
  const mapRefreshNonce = useAppStore((s) => s.mapRefreshNonce);
  const [basemap, setBasemap] = useState<'osm' | 'satellite' | 'terrain'>('osm');
  const [cursor, setCursor] = useState<{ lon: number; lat: number } | null>(null);
  const [drawMode, setDrawMode] = useState<DrawMode>('select');
  const [selectMode, setSelectMode] = useState<SelectMode>('single');
  const [selectMenuOpen, setSelectMenuOpen] = useState(false);
  const [selectedPoiId, setSelectedPoiId] = useState<string | null>(null);
  const [showRadii, setShowRadii] = useState(true);
  const [radiusVisible, setRadiusVisible] = useState<Record<string, boolean>>({
    gas_processing: true,
    gtes: true,
    substation: true,
    refinery: true,
  });
  const [lineDraft, setLineDraft] = useState<number[][]>([]);
  const [modal, setModal] = useState<
    | null
    | { type: 'poi'; lon: number; lat: number }
  >(null);
  const [poiForm, setPoiForm] = useState(emptyPoiFormValues);
  const [infraForm, setInfraForm] = useState({ subtype: 'gas_processing' });
  const [searchQ, setSearchQ] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchBlurRef = useRef<number | null>(null);
  const [featureSel, setFeatureSel] = useState<MapFeatureSelection | null>(null);
  const [featureGroupSel, setFeatureGroupSel] = useState<MapFeatureSelection[]>([]);
  const [candidateSubtype, setCandidateSubtype] = useState<string | null>(null);
  const [pointMenuOpen, setPointMenuOpen] = useState(false);
  const [lineMenuOpen, setLineMenuOpen] = useState(false);
  const [subtypeFilter, setSubtypeFilter] = useState<Record<string, boolean>>({
    gas_processing: true,
    gtes: true,
    substation: true,
    refinery: true,
    autoroad: true,
    oil_pipeline: true,
    gas_pipeline: true,
    water_pipeline: true,
    power_line: true,
  });
  const [showNetwork, setShowNetwork] = useState(false);

  useEffect(() => {
    // Map bbox filter disabled (prevents refetch on zoom/pan).
  }, [mapRefreshNonce]);

  useEffect(() => {
    if (drawMode !== 'select') {
      setFeatureSel(null);
      setFeatureGroupSel([]);
    }
  }, [drawMode]);

  useEffect(() => {
    if (selectMode === 'single') setFeatureGroupSel([]);
    else setFeatureSel(null);
  }, [selectMode]);

  const { data: pois = [] } = useQuery({
    queryKey: ['pois', projectId],
    queryFn: () => api.getPois(projectId!),
    enabled: !!projectId,
  });

  const { data: distanceDefaults } = useQuery({
    queryKey: ['distance-defaults', projectId],
    queryFn: () => api.getDistanceDefaults(projectId!),
    enabled: !!projectId,
  });

  const { data: layers = [] } = useQuery({
    queryKey: ['layers', projectId],
    queryFn: () => api.getLayers(projectId!),
    enabled: !!projectId,
    refetchOnMount: 'always',
  });

  const { data: infraObjects = [] } = useQuery({
    queryKey: ['infra', projectId],
    queryFn: () => api.getInfraObjects(projectId!),
    enabled: !!projectId,
    refetchOnMount: 'always',
  });

  const searchFilteredInfra = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    if (!q) return infraObjects;
    return infraObjects.filter((o) => o.name.toLowerCase().includes(q));
  }, [infraObjects, searchQ]);

  const searchSuggestions = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    if (!q) return [];
    const hits: { kind: 'poi' | 'infra'; id: string; name: string; subtitle: string }[] = [];
    for (const p of pois) {
      if (p.name.toLowerCase().includes(q)) {
        hits.push({ kind: 'poi', id: p.id, name: p.name, subtitle: 'Точка интереса' });
      }
    }
    for (const o of infraObjects) {
      if (o.name.toLowerCase().includes(q)) {
        hits.push({
          kind: 'infra',
          id: o.id,
          name: o.name,
          subtitle: SUBTYPE_LABELS[o.subtype] || o.subtype,
        });
      }
    }
    return hits.slice(0, 10);
  }, [searchQ, pois, infraObjects]);

  const pickSearchResult = useCallback(
    (hit: { kind: 'poi' | 'infra'; id: string; name: string }) => {
      setSearchQ(hit.name);
      setSearchOpen(false);
                setDrawMode('select');
                setSelectMenuOpen(false);
                setPointMenuOpen(false);
      setLineMenuOpen(false);
      if (hit.kind === 'poi') {
        setSelectedPoiId(hit.id);
        setFeatureSel({ kind: 'poi', id: hit.id });
      } else {
        setFeatureSel({ kind: 'infra', id: hit.id });
      }
    },
    []
  );

  const nextAutoName = useCallback(
    (subtype: string) => {
      const label = SUBTYPE_LABELS[subtype] || subtype;
      const base =
        queryClient.getQueryData<InfraObject[]>(['infra', projectId]) ?? infraObjects;
      const re = new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\\\]/g, '\\\\$&')}_([0-9]+)$`);
      let maxN = 0;
      for (const o of base || []) {
        if (o.subtype !== subtype) continue;
        const m = (o.name || '').match(re);
        if (m) maxN = Math.max(maxN, Number(m[1] || 0));
      }
      return `${label}_${maxN + 1}`;
    },
    [infraObjects, projectId, queryClient]
  );

  const visibleLayerIds = useMemo(
    () => new Set(layers.filter((l) => l.is_visible).map((l) => l.id)),
    [layers]
  );

  const filteredInfra = useMemo(
    () =>
      searchFilteredInfra.filter(
        (o) => subtypeFilter[o.subtype] !== false && visibleLayerIds.has(o.layer_id)
      ),
    [searchFilteredInfra, subtypeFilter, visibleLayerIds]
  );

  const selectedPoi = pois.find((p) => p.id === selectedPoiId) ?? pois[0] ?? null;

  const { data: analysisData } = useQuery({
    queryKey: ['analysis', projectId, selectedPoi?.id],
    queryFn: () => api.getPoiAnalysis(projectId!, selectedPoi!.id),
    enabled: !!projectId && !!selectedPoi?.id,
    retry: false,
  });

  const analysisRows: AnalysisRow[] = analysisData?.rows ?? [];

  const thresholdKm = (subtype: string, fallback: number) => {
    if (!selectedPoi) return fallback;
    const poiKey = `threshold_${subtype}_km` as keyof typeof selectedPoi;
    const poiVal = selectedPoi[poiKey];
    if (typeof poiVal === 'number' && poiVal > 0) return poiVal;
    if (distanceDefaults) {
      const dKey = `threshold_${subtype}_km` as keyof typeof distanceDefaults;
      const dv = distanceDefaults[dKey];
      if (typeof dv === 'number') return dv;
    }
    return fallback;
  };

  const thresholdCircles: ThresholdCircle[] = useMemo(() => {
    if (!selectedPoi) return [];
    return THRESHOLD_META.map((m) => ({
      key: m.subtype,
      km: thresholdKm(m.subtype, m.defaultKm),
      color: m.color,
      visible: radiusVisible[m.subtype] ?? true,
    }));
  }, [selectedPoi, radiusVisible, distanceDefaults]);

  const { data: networks = [] } = useQuery({
    queryKey: ['networks', projectId],
    queryFn: () => api.getNetworks(projectId!),
    enabled: !!projectId && showNetwork,
  });
  const networkId = networks[0]?.id;
  const { data: networkNodes = [] } = useQuery({
    queryKey: ['network-nodes', projectId, networkId],
    queryFn: () => api.getNetworkNodes(projectId!, networkId!),
    enabled: !!projectId && !!networkId && showNetwork,
  });
  const { data: networkEdges = [] } = useQuery({
    queryKey: ['network-edges', projectId, networkId],
    queryFn: () => api.getNetworkEdges(projectId!, networkId!),
    enabled: !!projectId && !!networkId && showNetwork,
  });

  const groupSelectionDetails = useMemo(() => {
    return featureGroupSel
      .map((sel) => {
        if (sel.kind === 'poi') {
          const poi = pois.find((p) => p.id === sel.id);
          return poi ? { id: sel.id, name: poi.name, kind: 'poi' as const } : null;
        }
        const obj = infraObjects.find((o) => o.id === sel.id);
        return obj
          ? { id: sel.id, name: obj.name, kind: 'infra' as const, subtitle: SUBTYPE_LABELS[obj.subtype] || obj.subtype }
          : null;
      })
      .filter(Boolean) as { id: string; name: string; kind: 'poi' | 'infra'; subtitle?: string }[];
  }, [featureGroupSel, pois, infraObjects]);

  const detailSelection: SelectedFeature | null = useMemo(() => {
    if (!featureSel) return null;
    if (featureSel.kind === 'poi') {
      const poi = pois.find((p) => p.id === featureSel.id);
      return poi ? { kind: 'poi', poi } : null;
    }
    const obj = infraObjects.find((o) => o.id === featureSel.id);
    return obj ? { kind: 'infra', object: obj } : null;
  }, [featureSel, pois, infraObjects]);

  const invalidateMap = () => {
    if (!projectId) return;
    queryClient.invalidateQueries({ queryKey: ['pois', projectId] });
    void refreshMapQueries(queryClient, projectId);
  };

  const createPoiMut = useMutation({
    mutationFn: (data: Parameters<typeof api.createPoi>[1]) => api.createPoi(projectId!, data),
    onSuccess: () => {
      invalidateMap();
      setModal(null);
      setDrawMode('select');
    },
    onError: (err) => {
      window.alert(err instanceof Error ? err.message : 'Не удалось сохранить точку интереса');
    },
  });

  const createInfraMut = useMutation({
    mutationFn: (data: Parameters<typeof api.createInfraObject>[1]) => api.createInfraObject(projectId!, data),
    onSuccess: () => {
      invalidateMap();
      setModal(null);
      setLineDraft([]);
    },
  });

  const analyzeMut = useMutation({
    mutationFn: () => api.analyzePoi(projectId!, selectedPoi!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analysis', projectId, selectedPoi?.id] });
    },
  });

  const deleteInfraMut = useMutation({
    mutationFn: (id: string) => api.deleteInfraObject(projectId!, id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['infra', projectId] });
      const snapshots = queryClient.getQueriesData<InfraObject[]>({ queryKey: ['infra', projectId] });
      queryClient.setQueriesData<InfraObject[]>({ queryKey: ['infra', projectId] }, (old) =>
        old ? old.filter((o) => o.id !== id) : []
      );
      return { snapshots };
    },
    onError: (err, _id, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      window.alert(err instanceof Error ? err.message : 'Не удалось удалить объект');
    },
    onSuccess: (_data, id) => {
      setFeatureSel((sel) => (sel?.id === id ? null : sel));
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ['infra', projectId] });
      await queryClient.invalidateQueries({ queryKey: ['network-nodes', projectId] });
      await queryClient.invalidateQueries({ queryKey: ['network-edges', projectId] });
      invalidateMap();
    },
  });

  const deleteGroupMut = useMutation({
    mutationFn: async (items: MapFeatureSelection[]) => {
      await Promise.all(
        items.map((sel) =>
          sel.kind === 'poi'
            ? api.deletePoi(projectId!, sel.id)
            : api.deleteInfraObject(projectId!, sel.id)
        )
      );
    },
    onSuccess: (_data, items) => {
      const deletedIds = new Set(items.map((s) => s.id));
      setFeatureGroupSel([]);
      setFeatureSel((sel) => (sel && deletedIds.has(sel.id) ? null : sel));
      invalidateMap();
    },
    onError: (err) => {
      window.alert(err instanceof Error ? err.message : 'Не удалось удалить объекты');
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ['pois', projectId] });
      await queryClient.invalidateQueries({ queryKey: ['infra', projectId] });
      await queryClient.invalidateQueries({ queryKey: ['network-nodes', projectId] });
      await queryClient.invalidateQueries({ queryKey: ['network-edges', projectId] });
    },
  });

  const handleDeleteGroupSelection = () => {
    if (!projectId || featureGroupSel.length === 0 || deleteGroupMut.isPending) return;
    const count = featureGroupSel.length;
    const confirmed = window.confirm(
      `Удалить ${count} ${count === 1 ? 'объект' : count < 5 ? 'объекта' : 'объектов'}? Это действие нельзя отменить.`
    );
    if (!confirmed) return;
    deleteGroupMut.mutate(featureGroupSel);
  };

  const saveDetailMut = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      if (!detailSelection) return;
      if (detailSelection.kind === 'poi') {
        return api.updatePoi(projectId!, detailSelection.poi.id, {
          name: data.name as string,
          description: data.description as string,
          lon: data.lon as number,
          lat: data.lat as number,
        });
      }
      return api.updateInfraObject(projectId!, detailSelection.object.id, {
        name: data.name as string,
        description: data.description as string,
        subtype: data.subtype as string,
        layer_id: data.layer_id as string,
        lon: data.lon as number,
        lat: data.lat as number,
        ...(Array.isArray(data.coordinates)
          ? {
              coordinates: data.coordinates as number[][],
              end_lon: data.end_lon as number,
              end_lat: data.end_lat as number,
            }
          : {}),
        ...(data.properties ? { properties: data.properties as Record<string, unknown> } : {}),
      });
    },
    onSuccess: invalidateMap,
  });

  const overrideMut = useMutation({
    mutationFn: (c: Candidate) =>
      api.overrideAnalysis(projectId!, selectedPoi!.id, candidateSubtype!, {
        nearest_object_id: c.object_id ?? undefined,
        nearest_node_id: c.nearest_node_id ?? undefined,
      }),
    onSuccess: () => {
      setCandidateSubtype(null);
      queryClient.invalidateQueries({ queryKey: ['analysis', projectId, selectedPoi?.id] });
    },
  });

  const buildNetworkMut = useMutation({
    mutationFn: () => api.buildNetwork(projectId!),
    onSuccess: () => {
      setShowNetwork(true);
      queryClient.invalidateQueries({ queryKey: ['networks', projectId] });
    },
  });

  const handleGeometryChange = useCallback(
    async (sel: MapFeatureSelection, lon: number, lat: number, coords?: number[][]) => {
      if (!projectId) return;
      const rLon = roundCoord(lon);
      const rLat = roundCoord(lat);
      try {
        if (sel.kind === 'poi') {
          await api.updatePoi(projectId, sel.id, { lon: rLon, lat: rLat });
          queryClient.setQueriesData<POI[]>({ queryKey: ['pois', projectId] }, (old) =>
            old?.map((p) => (p.id === sel.id ? { ...p, lon: rLon, lat: rLat } : p)) ?? []
          );
        } else if (coords && coords.length >= 2) {
          const roundedCoords = coords.map(([lo, la]) => [roundCoord(lo), roundCoord(la)] as [number, number]);
          const payload = {
            lon: roundedCoords[0][0],
            lat: roundedCoords[0][1],
            end_lon: roundedCoords[roundedCoords.length - 1][0],
            end_lat: roundedCoords[roundedCoords.length - 1][1],
            coordinates: roundedCoords,
          };
          await api.updateInfraObject(projectId, sel.id, payload);
          queryClient.setQueriesData<InfraObject[]>({ queryKey: ['infra', projectId] }, (old) =>
            old?.map((o) => (o.id === sel.id ? { ...o, ...payload } : o)) ?? []
          );
        } else {
          await api.updateInfraObject(projectId, sel.id, { lon: rLon, lat: rLat });
          queryClient.setQueriesData<InfraObject[]>({ queryKey: ['infra', projectId] }, (old) =>
            old?.map((o) => (o.id === sel.id ? { ...o, lon: rLon, lat: rLat } : o)) ?? []
          );
        }
      } catch (e) {
        window.alert(e instanceof Error ? e.message : 'Не удалось сохранить геометрию');
        await refreshMapQueries(queryClient, projectId);
        queryClient.invalidateQueries({ queryKey: ['pois', projectId] });
      }
    },
    [projectId, queryClient]
  );

  const handleMapClick = useCallback(
    (lon: number, lat: number) => {
      if (drawMode === 'poi') {
        setPoiForm(
          emptyPoiFormValues({
            lon: formatCoord(lon),
            lat: formatCoord(lat),
          })
        );
        setModal({ type: 'poi', lon, lat });
        return;
      }
      if (drawMode === 'point') {
        if (!projectId) return;
        const subtype = infraForm.subtype;
        createInfraMut.mutate({
          name: nextAutoName(subtype),
          subtype,
          lon: roundCoord(lon),
          lat: roundCoord(lat),
        });
        return;
      }
      if (drawMode === 'line') {
        // Polyline drawing: each click adds a vertex; finishing is explicit (see toolbar).
        setLineDraft((prev) => [...prev, [lon, lat]]);
      }
    },
    [createInfraMut, drawMode, infraForm.subtype, nextAutoName, projectId]
  );

  const submitPoi = () => {
    if (!projectId) {
      window.alert('Выберите проект в шапке приложения');
      return;
    }
    if (!modal || modal.type !== 'poi') return;
    const name = poiForm.name.trim();
    if (!name) {
      window.alert('Укажите название точки интереса');
      return;
    }
    const lon = parseCoord(poiForm.lon || formatCoord(modal.lon));
    const lat = parseCoord(poiForm.lat || formatCoord(modal.lat));
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
      window.alert('Укажите корректные координаты');
      return;
    }
    const payload = formValuesToPoiCreatePayload({
      ...poiForm,
      name,
      lon: formatCoord(lon),
      lat: formatCoord(lat),
    });
    createPoiMut.mutate(payload as Parameters<typeof api.createPoi>[1]);
  };

  const submitInfraLine = (coords: number[][]) => {
    if (!projectId) return;
    if (!coords || coords.length < 2) return;
    const subtype = infraForm.subtype;
    createInfraMut.mutate({
      name: nextAutoName(subtype),
      subtype,
      lon: roundCoord(coords[0][0]),
      lat: roundCoord(coords[0][1]),
      end_lon: roundCoord(coords[coords.length - 1][0]),
      end_lat: roundCoord(coords[coords.length - 1][1]),
      coordinates: coords.map(([lo, la]) => [roundCoord(lo), roundCoord(la)]),
    });
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold">Карта</h1>
        <div className="flex flex-wrap gap-2 items-center">
          <select
            value={basemap}
            onChange={(e) => setBasemap(e.target.value as typeof basemap)}
            className="text-sm px-3 py-1.5 rounded-lg border"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
          >
            <option value="osm">OpenStreetMap</option>
            <option value="satellite">Satellite</option>
            <option value="terrain">Terrain</option>
          </select>
          {pois.length > 0 && (
            <select
              value={selectedPoiId ?? pois[0].id}
              onChange={(e) => setSelectedPoiId(e.target.value)}
              className="text-sm px-3 py-1.5 rounded-lg border max-w-[200px]"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
            >
              {pois.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          {selectedPoi && (
            <button
              type="button"
              className="btn btn-primary text-sm"
              onClick={() => analyzeMut.mutate()}
              disabled={analyzeMut.isPending}
            >
              <Zap size={14} className="inline mr-1" />
              Анализ
            </button>
          )}
        </div>
      </div>

      {!projectId && (
        <div className="card mb-4 text-sm" style={{ color: 'var(--text-muted)' }}>
          Выберите проект на странице «Проекты».
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-1 mb-2 p-2 rounded-lg border" style={{ borderColor: 'var(--border)' }}>
            <div className="relative inline-block">
              <button
                type="button"
                className={`btn text-sm ${drawMode === 'select' || selectMenuOpen ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => {
                  if (drawMode === 'select') {
                    setSelectMenuOpen((open) => !open);
                    return;
                  }
                  setLineDraft([]);
                  setPointMenuOpen(false);
                  setLineMenuOpen(false);
                  setDrawMode('select');
                  setSelectMenuOpen(true);
                }}
              >
                {selectMode === 'box' ? (
                  <BoxSelect size={14} className="inline mr-1" />
                ) : (
                  <MousePointer2 size={14} className="inline mr-1" />
                )}
                Выбор
              </button>
              {selectMenuOpen && (
                <div
                  className="absolute z-10 mt-1 w-56 rounded-lg border bg-[var(--surface)] shadow-lg text-sm"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <button
                    type="button"
                    className={`w-full text-left px-3 py-2 hover:bg-[var(--bg)] flex items-center gap-2 ${
                      drawMode === 'select' && selectMode === 'single' ? 'font-medium' : ''
                    }`}
                    onClick={() => {
                      setSelectMode('single');
                      setDrawMode('select');
                      setSelectMenuOpen(false);
                      setLineDraft([]);
                      setPointMenuOpen(false);
                      setLineMenuOpen(false);
                    }}
                  >
                    <MousePointer2 size={14} className="shrink-0 opacity-70" />
                    <span>Один объект</span>
                  </button>
                  <button
                    type="button"
                    className={`w-full text-left px-3 py-2 hover:bg-[var(--bg)] flex items-center gap-2 ${
                      drawMode === 'select' && selectMode === 'box' ? 'font-medium' : ''
                    }`}
                    onClick={() => {
                      setSelectMode('box');
                      setDrawMode('select');
                      setSelectMenuOpen(false);
                      setLineDraft([]);
                      setPointMenuOpen(false);
                      setLineMenuOpen(false);
                    }}
                  >
                    <BoxSelect size={14} className="shrink-0 opacity-70" />
                    <span>Группа объектов</span>
                  </button>
                </div>
              )}
            </div>
            <button
              type="button"
              className={`btn text-sm ${drawMode === 'poi' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => {
                if (drawMode === 'poi') {
                  setDrawMode('select');
                  return;
                }
                setDrawMode('poi');
                setLineDraft([]);
                setSelectMenuOpen(false);
                setPointMenuOpen(false);
                setLineMenuOpen(false);
              }}
            >
              <MapPin size={14} className="inline mr-1" />
              POI
            </button>
            <div className="relative inline-block">
              <button
                type="button"
                className={`btn text-sm ${drawMode === 'point' || pointMenuOpen ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => {
                  if (drawMode === 'point') {
                setDrawMode('select');
                setSelectMenuOpen(false);
                setPointMenuOpen(false);
                    return;
                  }
                  if (pointMenuOpen) {
                    setPointMenuOpen(false);
                    return;
                  }
                  setLineDraft([]);
                  setSelectMenuOpen(false);
                  setLineMenuOpen(false);
                  setPointMenuOpen(true);
                }}
              >
                <MapPin size={14} className="inline mr-1" />
                Точка
              </button>
              {pointMenuOpen && (
                <div
                  className="absolute z-10 mt-1 w-44 rounded-lg border bg-[var(--surface)] shadow-lg text-sm"
                  style={{ borderColor: 'var(--border)' }}
                >
                  {POINT_SUBTYPES.map((st) => (
                    <button
                      key={st}
                      type="button"
                      className={`w-full text-left px-3 py-1.5 hover:bg-[var(--bg)] flex items-center gap-2 ${
                        infraForm.subtype === st ? 'font-medium' : ''
                      }`}
                      onClick={() => {
                        setInfraForm((f) => ({ ...f, subtype: st }));
                        setPointMenuOpen(false);
                        setSelectMenuOpen(false);
                        setDrawMode('point');
                      }}
                    >
                      <img
                        src={iconDataUrl(st)}
                        alt=""
                        className="w-4 h-4 shrink-0"
                        draggable={false}
                      />
                      <span className="truncate">{SUBTYPE_LABELS[st] || st}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative inline-block">
            <button
              type="button"
              className={`btn text-sm ${drawMode === 'line' || lineMenuOpen ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => {
                if (drawMode === 'line') {
                  setDrawMode('select');
                  setLineDraft([]);
                  setLineMenuOpen(false);
                  return;
                }
                if (lineMenuOpen) {
                  setLineMenuOpen(false);
                  return;
                }
                setLineDraft([]);
                setSelectMenuOpen(false);
                setPointMenuOpen(false);
                setLineMenuOpen(true);
              }}
            >
              <Pencil size={14} className="inline mr-1" />
              Линия
            </button>
            {lineMenuOpen && (
              <div
                className="absolute z-10 mt-1 w-44 rounded-lg border bg-[var(--surface)] shadow-lg text-sm"
                style={{ borderColor: 'var(--border)' }}
              >
                {LINE_SUBTYPES.map((st) => (
                  <button
                    key={st}
                    type="button"
                    className={`w-full text-left px-3 py-1.5 hover:bg-[var(--bg)] flex items-center gap-2 ${
                      infraForm.subtype === st ? 'font-medium' : ''
                    }`}
                    onClick={() => {
                      setInfraForm((f) => ({ ...f, subtype: st }));
                      setLineMenuOpen(false);
                      setSelectMenuOpen(false);
                      setDrawMode('line');
                    }}
                  >
                    <img src={iconDataUrl(st)} alt="" className="w-4 h-4 shrink-0" draggable={false} />
                    <span className="truncate">{SUBTYPE_LABELS[st] || st}</span>
                  </button>
                ))}
              </div>
            )}
            </div>
            {drawMode === 'line' && (
              <>
                {lineDraft.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-secondary text-sm"
                    onClick={() => setLineDraft((d) => d.slice(0, -1))}
                    title="Удалить последнюю точку"
                  >
                    <Minus size={14} /> Шаг назад
                  </button>
                )}
                {lineDraft.length >= 2 && (
                  <button
                    type="button"
                    className="btn btn-primary text-sm"
                    onClick={() => {
                      submitInfraLine(lineDraft);
                      setLineDraft([]);
                    }}
                    title="Завершить линию"
                  >
                    <Pencil size={14} className="inline mr-1" />
                    Готово
                  </button>
                )}
                {lineDraft.length > 0 && (
                  <button type="button" className="btn btn-secondary text-sm" onClick={() => setLineDraft([])}>
                    <Minus size={14} /> Сброс
                  </button>
                )}
              </>
            )}
            {projectId && (
              <div className="relative ml-auto min-w-[140px] max-w-[220px]">
                <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 opacity-40 pointer-events-none" />
                <input
                  type="search"
                  className="w-full text-sm py-1.5 pl-7 pr-2 rounded-md border bg-transparent"
                  style={{ borderColor: 'var(--border)' }}
                  placeholder="Поиск…"
                  value={searchQ}
                  onChange={(e) => {
                    setSearchQ(e.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => {
                    if (searchBlurRef.current) window.clearTimeout(searchBlurRef.current);
                    setSearchOpen(true);
                  }}
                  onBlur={() => {
                    searchBlurRef.current = window.setTimeout(() => setSearchOpen(false), 150);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setSearchOpen(false);
                    if (e.key === 'Enter' && searchSuggestions[0]) {
                      e.preventDefault();
                      pickSearchResult(searchSuggestions[0]);
                    }
                  }}
                />
                {searchOpen && searchQ.trim() && (
                  <div
                    className="absolute z-20 top-full left-0 right-0 mt-1 rounded-md border shadow-lg overflow-hidden text-sm"
                    style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                  >
                    {searchSuggestions.length === 0 ? (
                      <div className="px-3 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                        Ничего не найдено
                      </div>
                    ) : (
                      searchSuggestions.map((hit) => (
                        <button
                          key={`${hit.kind}-${hit.id}`}
                          type="button"
                          className="w-full text-left px-3 py-1.5 hover:bg-[var(--bg)] border-b last:border-b-0"
                          style={{ borderColor: 'var(--border)' }}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => pickSearchResult(hit)}
                        >
                          <div className="truncate font-medium">{hit.name}</div>
                          <div className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>
                            {hit.subtitle}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="relative">
          <MapView
            pois={pois}
            infraObjects={filteredInfra}
            basemap={basemap}
            drawMode={drawMode}
            selectMode={selectMode}
            onMapClick={projectId && drawMode !== 'select' ? handleMapClick : undefined}
            onFinishLine={(coords) => {
              if (drawMode !== 'line') return;
              if (coords.length >= 2) {
                submitInfraLine(coords);
                setLineDraft([]);
              }
            }}
            onPointerMove={(lon, lat) => setCursor({ lon: roundCoord(lon), lat: roundCoord(lat) })}
            onFeatureSelect={drawMode === 'select' && selectMode === 'single' ? setFeatureSel : undefined}
            onFeatureGroupSelect={drawMode === 'select' && selectMode === 'box' ? setFeatureGroupSel : undefined}
            onGeometryChange={handleGeometryChange}
            onBboxChange={undefined}
            connectionLines={analysisRows}
            selectedPoi={selectedPoi}
            selectedFeatureId={featureSel?.id ?? null}
            selectedFeatureIds={featureGroupSel.map((s) => s.id)}
            thresholdCircles={thresholdCircles}
            draftLine={lineDraft}
            showRadii={showRadii}
            useMapIcons
            networkNodes={showNetwork ? networkNodes : []}
            networkEdges={showNetwork ? networkEdges : []}
            layers={layers}
          />

          {detailSelection && drawMode === 'select' && selectMode === 'single' && (
            <ObjectDetailPanel
              selection={detailSelection}
              layers={layers}
              saving={saveDetailMut.isPending}
              onClose={() => setFeatureSel(null)}
              onSave={(data) => saveDetailMut.mutate(data)}
              onDelete={() => {
                if (!detailSelection || !projectId) return;
                if (detailSelection.kind === 'poi') {
                  api.deletePoi(projectId, detailSelection.poi.id).then(() => {
                    setFeatureSel(null);
                    invalidateMap();
                  });
                } else {
                  deleteInfraMut.mutate(detailSelection.object.id);
                }
              }}
            />
          )}

          {drawMode === 'select' && selectMode === 'box' && groupSelectionDetails.length > 0 && (
            <div
              className="absolute top-3 left-3 z-10 card p-3 w-64 max-h-72 flex flex-col shadow-lg"
              style={{ background: 'var(--surface)' }}
            >
              <div className="flex items-center justify-between gap-2 mb-2 shrink-0">
                <h3 className="font-semibold text-sm">Выбрано: {groupSelectionDetails.length}</h3>
                <button
                  type="button"
                  className="p-1 rounded hover:bg-[var(--bg)]"
                  onClick={() => setFeatureGroupSel([])}
                  title="Сбросить выделение"
                >
                  <X size={14} />
                </button>
              </div>
              <ul className="text-sm overflow-y-auto min-h-0 space-y-1">
                {groupSelectionDetails.map((item) => (
                  <li key={item.id} className="truncate py-0.5 border-b last:border-b-0" style={{ borderColor: 'var(--border)' }}>
                    <div className="font-medium truncate">{item.name}</div>
                    <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                      {item.kind === 'poi' ? 'Точка интереса' : item.subtitle}
                    </div>
                  </li>
                ))}
              </ul>
              <p className="text-xs mt-2 shrink-0" style={{ color: 'var(--text-muted)' }}>
                Зажмите ЛКМ и выделите прямоугольником
              </p>
              <button
                type="button"
                className="btn btn-secondary text-xs mt-2 shrink-0 w-full py-1.5"
                onClick={handleDeleteGroupSelection}
                disabled={deleteGroupMut.isPending}
              >
                <Trash2 size={12} className="inline mr-1" />
                {deleteGroupMut.isPending ? 'Удаление…' : 'Удалить объекты'}
              </button>
            </div>
          )}

          </div>

          <div className="flex justify-between mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            <span>
              {cursor ? formatCoordPair(cursor.lon, cursor.lat) : 'Координаты курсора'}
            </span>
            <a href="/import" className="text-blue-600 hover:underline">
              Импорт инфраструктуры
            </a>
          </div>
        </div>

        <aside className="space-y-3">
          <div className="card p-0 overflow-hidden">
            {projectId && (
              <LayerPanel
                layers={layers}
                subtypeFilter={subtypeFilter}
                onSubtypeFilterChange={(st, v) => setSubtypeFilter((f) => ({ ...f, [st]: v }))}
                onCreate={async (name) => {
                  await api.createLayer(projectId, { name, sort_order: layers.length });
                  invalidateMap();
                }}
                onUpdate={async (layerId, data) => {
                  await api.updateLayer(projectId, layerId, data);
                  invalidateMap();
                }}
                onDelete={async (layerId) => {
                  await api.deleteLayer(projectId, layerId);
                  invalidateMap();
                }}
                onReorder={async (orderedIds) => {
                  await Promise.all(
                    orderedIds.map((id, i) => api.updateLayer(projectId, id, { sort_order: i }))
                  );
                  invalidateMap();
                }}
              />
            )}
          </div>

          {projectId && (
            <div className="card text-sm flex gap-2">
              <button
                type="button"
                className="btn btn-secondary text-sm flex-1"
                onClick={() => buildNetworkMut.mutate()}
                disabled={buildNetworkMut.isPending}
              >
                <Network size={14} className="inline mr-1" />
                Построить сеть
              </button>
              <label className="flex items-center gap-1 text-xs">
                <input type="checkbox" checked={showNetwork} onChange={(e) => setShowNetwork(e.target.checked)} />
                Слой сети
              </label>
            </div>
          )}

          <div className="card text-sm">
            <label className="flex items-center gap-2 font-semibold mb-2">
              <input type="checkbox" checked={showRadii} onChange={(e) => setShowRadii(e.target.checked)} />
              Пороговые радиусы
            </label>
            {THRESHOLD_META.map((m) => (
              <label key={m.subtype} className="flex items-center gap-2 py-0.5">
                <input
                  type="checkbox"
                  checked={radiusVisible[m.subtype] ?? true}
                  onChange={(e) =>
                    setRadiusVisible((v) => ({ ...v, [m.subtype]: e.target.checked }))
                  }
                />
                <span className="w-3 h-3 rounded-full inline-block" style={{ background: m.color }} />
                {m.label}
              </label>
            ))}
          </div>

          {analysisRows.length > 0 && (
            <div className="card text-sm max-h-64 overflow-auto">
              <h3 className="font-semibold mb-2">Анализ</h3>
              {analysisRows.map((row) => (
                <div key={row.subtype} className="py-1 border-b" style={{ borderColor: 'var(--border)' }}>
                  <div className="font-medium">{SUBTYPE_LABELS[row.subtype] || row.subtype}</div>
                  <div style={{ color: 'var(--text-muted)' }}>
                    {row.status}
                    {row.distance_km != null ? ` · ${row.distance_km} км` : ''}
                    {row.object_name ? ` · ${row.object_name}` : ''}
                  </div>
                  {row.param_type === 'external' && selectedPoi && (
                    <button
                      type="button"
                      className="text-xs text-blue-600 mt-1"
                      onClick={() => setCandidateSubtype(row.subtype)}
                    >
                      Выбрать другой
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

        </aside>
      </div>

      {modal?.type === 'poi' && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-2xl max-h-[90vh] flex flex-col">
            <h3 className="font-semibold mb-3 shrink-0">Новая точка интереса</h3>
            <div className="flex-1 overflow-y-auto min-h-0">
              <PoiParamsForm
                value={poiForm}
                onChange={setPoiForm}
                coordsReadOnly={false}
              />
            </div>
            <div className="flex gap-2 justify-end shrink-0 pt-3 border-t mt-3" style={{ borderColor: 'var(--border)' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>
                Отмена
              </button>
              <button type="button" className="btn btn-primary" onClick={submitPoi} disabled={createPoiMut.isPending}>
                Сохранить точку
              </button>
            </div>
          </div>
        </div>
      )}

      {candidateSubtype && selectedPoi && projectId && (
        <CandidatesModal
          projectId={projectId}
          poiId={selectedPoi.id}
          subtype={candidateSubtype}
          onClose={() => setCandidateSubtype(null)}
          onSelect={(c) => overrideMut.mutate(c)}
        />
      )}

      {/* Infrastructure objects are created immediately (no modal). */}
    </div>
  );
}
