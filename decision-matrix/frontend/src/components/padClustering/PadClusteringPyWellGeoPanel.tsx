import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  GitBranch,
  Thermometer,
  FileCode,
  Compass,
  Settings2,
  Download,
  Upload,
  RefreshCw,
  Link2,
  Layers,
  ChevronRight,
  Loader2,
  Minimize2,
} from 'lucide-react';
import { Button, Upload as AntUpload, Input } from 'antd';
import { AppSelect } from '../AppSelect';
import { PadClusteringCollapsibleSection } from './PadClusteringCollapsibleSection';
import type { InfraObject } from '../../lib/api';
import type { WellTrajectory } from '../../lib/api/wellTrajectoryApi';
import { pywellgeoApi } from '../../lib/api/pywellgeoApi';
import type { PadClusteringPyWellGeoDraft } from '../../lib/padClusteringPyWellGeoSettings';
import {
  buildBottomholeSelectOptions,
  buildBottomholeTargetCatalog,
  bottomholeTargetMarkerColor,
  findBottomholeTargetById,
  filterTreeNodes,
  groupTreeNodes,
  lateralBottomholeTargetsForWell,
  lateralXyzFromAzimDip,
  parseXyzLines,
  type LateralMode,
  type TreeListFilter,
} from '../../lib/padClusteringPyWellGeoLateral';
import { GS_HEEL_LABEL, GS_TOE_LABEL, bottomholesLinkedToPad } from '../../lib/wellBottomholeProperties';
import {
  flattenTree,
  removeBranchAtPath,
  setNodeAtPath,
  treeForWellIndex,
  type TreeNodePath,
  upsertTree,
  wellLabel,
} from '../../lib/padClusteringPyWellGeoSettings';

type Props = {
  readOnly: boolean;
  projectId: string;
  padId: string;
  draft: PadClusteringPyWellGeoDraft;
  patchDraft: (patch: Partial<PadClusteringPyWellGeoDraft>) => void;
  trajectories: WellTrajectory[];
  selectedWellIndex: number;
  onSelectWell: (index: number) => void;
  infraObjects?: InfraObject[];
  bottomholes?: InfraObject[];
  padLon?: number;
  padLat?: number;
  onPlotSegmentsChange?: (segments: import('../../lib/api/pywellgeoApi').PyWellGeoPlotSegment[]) => void;
  onSelectedTreeNodeChange?: (
    node: { x: number; y: number; z: number; color?: string } | null,
  ) => void;
  onLateralTargetChange?: (
    node: { x: number; y: number; z: number; color?: string } | null,
  ) => void;
};

const BRANCH_COLORS = [
  { value: 'black', label: 'Чёрный' },
  { value: 'orange', label: 'Оранжевый' },
  { value: 'red', label: 'Красный' },
  { value: 'grey', label: 'Серый' },
  { value: 'blue', label: 'Синий (перф.)' },
];

const BRANCH_COLOR_HEX: Record<string, string> = {
  black: '#1e293b',
  orange: '#f97316',
  red: '#ef4444',
  grey: '#94a3b8',
  blue: '#3b82f6',
};

function branchColorCss(color: string): string {
  return BRANCH_COLOR_HEX[color] ?? color;
}

const TREE_FILTER_OPTIONS: { value: TreeListFilter; label: string }[] = [
  { value: 'main_and_kickoffs', label: 'Ствол + боковые' },
  { value: 'branches_only', label: 'Ветки' },
  { value: 'all', label: 'Все' },
];

function GeoField({
  label,
  hint,
  span = 1,
  children,
}: {
  label: string;
  hint?: string;
  span?: 1 | 2;
  children: ReactNode;
}) {
  return (
    <label
      className={`pad-clustering-field pad-clustering-field--cell${
        span === 2 ? ' pad-clustering-field--span2' : ''
      }`}
    >
      <span className="pad-clustering-field__label">{label}</span>
      {children}
      {hint ? <span className="pad-clustering-field__hint">{hint}</span> : null}
    </label>
  );
}

function GeoSubsection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="pad-clustering-calc-subsection">
      <h4 className="pad-clustering-calc-subsection__title">{title}</h4>
      <div className="pad-clustering-field-grid">{children}</div>
    </div>
  );
}

function GeoActionBar({
  title,
  hint,
  layout = 'wrap',
  footer,
  children,
}: {
  title?: string;
  hint?: string;
  layout?: 'wrap' | 'grid' | 'pipeline';
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className={`pad-clustering-geo-panel__action-bar pad-clustering-geo-panel__action-bar--${layout}`}
    >
      {title || hint ? (
        <div className="pad-clustering-geo-panel__action-bar-head">
          {title ? (
            <span className="pad-clustering-geo-panel__action-bar-title">{title}</span>
          ) : null}
          {hint ? (
            <span className="pad-clustering-geo-panel__action-bar-hint">{hint}</span>
          ) : null}
        </div>
      ) : null}
      <div className="pad-clustering-geo-panel__action-bar-body">{children}</div>
      {footer ? <div className="pad-clustering-geo-panel__action-bar-footer">{footer}</div> : null}
    </div>
  );
}

function GeoActionButton({
  icon,
  label,
  loadingLabel,
  loading = false,
  disabled = false,
  title,
  variant = 'secondary',
  fullWidth = false,
  accent = false,
  onClick,
}: {
  icon?: ReactNode;
  label: string;
  loadingLabel?: string;
  loading?: boolean;
  disabled?: boolean;
  title?: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  fullWidth?: boolean;
  accent?: boolean;
  onClick: () => void;
}) {
  const buttonType =
    variant === 'primary' || accent ? 'primary' : variant === 'ghost' ? 'text' : 'default';

  return (
    <Button
      type={buttonType}
      size="small"
      block={fullWidth}
      className={[
        'pad-clustering-geo-action-btn',
        fullWidth ? 'pad-clustering-geo-action-btn--full' : '',
        loading ? 'pad-clustering-geo-action-btn--loading' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      disabled={disabled}
      loading={loading}
      title={title}
      icon={icon}
      onClick={onClick}
    >
      {loading ? loadingLabel ?? label : label}
    </Button>
  );
}

function nodePathLabel(path: TreeNodePath): string {
  return path.map((i) => i + 1).join('.');
}

function nodeListTitle(path: TreeNodePath, node: import('../../lib/api/pywellgeoApi').PyWellGeoTreeNode): string {
  if (path.length === 0) {
    return node.name && node.name !== 'main' ? node.name : 'Ствол';
  }
  const label = nodePathLabel(path);
  if (label.length <= 11) return label;
  return `…${label.slice(-9)}`;
}

function nodeListHint(path: TreeNodePath, node: import('../../lib/api/pywellgeoApi').PyWellGeoTreeNode): string {
  if (path.length === 0) return nodeListTitle(path, node);
  return `Ветка ${nodePathLabel(path)} · глубина ${path.length}`;
}

export function PadClusteringPyWellGeoPanel({
  readOnly,
  projectId,
  padId,
  draft,
  patchDraft,
  trajectories,
  selectedWellIndex,
  onSelectWell,
  infraObjects = [],
  bottomholes = [],
  padLon = 0,
  padLat = 0,
  onPlotSegmentsChange,
  onSelectedTreeNodeChange,
  onLateralTargetChange,
}: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<TreeNodePath>([]);
  const [treeListFilter, setTreeListFilter] = useState<TreeListFilter>('main_and_kickoffs');
  const [lateralMode, setLateralMode] = useState<LateralMode>('bottomhole');
  const [lateralName, setLateralName] = useState('lat1');
  const [lateralColor, setLateralColor] = useState('orange');
  const [lateralAzim, setLateralAzim] = useState('90');
  const [lateralDip, setLateralDip] = useState('30');
  const [lateralLength, setLateralLength] = useState('200');
  const [lateralXyzText, setLateralXyzText] = useState('');
  const [lateralBottomholeId, setLateralBottomholeId] = useState('');
  const [lateralDlsDesign, setLateralDlsDesign] = useState('3');
  const [lateralDesignHint, setLateralDesignHint] = useState<string | null>(null);
  const [coarsenHint, setCoarsenHint] = useState<string | null>(null);
  const [yamlPreview, setYamlPreview] = useState('');
  const [yamlError, setYamlError] = useState<string | null>(null);
  const [tempProfile, setTempProfile] = useState<Array<{ depth_m: number; temp_c: number }>>([]);
  const [azimMode, setAzimMode] = useState<'vector_to_azim_dip' | 'azim_dip_to_vector'>('azim_dip_to_vector');
  const [azimDeg, setAzimDeg] = useState('45');
  const [dipDeg, setDipDeg] = useState('30');
  const [vecX, setVecX] = useState('0');
  const [vecY, setVecY] = useState('1');
  const [vecZ, setVecZ] = useState('0');
  const [azimResult, setAzimResult] = useState<string | null>(null);
  const [waterResult, setWaterResult] = useState<string | null>(null);
  const [coordPoints, setCoordPoints] = useState('0,0,0\n10,0,0');
  const [coordResult, setCoordResult] = useState<string | null>(null);
  const treeListRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLButtonElement | null>(null);
  const plotDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSelectedPath([]);
  }, [selectedWellIndex]);

  const wellOptions = useMemo(() => {
    const count = Math.max(trajectories.length, draft.trees.length, 1);
    return Array.from({ length: count }, (_, i) => ({
      value: String(i),
      label: wellLabel(i, trajectories[i]?.name),
    }));
  }, [trajectories, draft.trees.length]);

  const currentRecord = treeForWellIndex(draft.trees, selectedWellIndex);
  const currentTrajectory = trajectories[selectedWellIndex];
  const surveyCount = currentTrajectory?.survey?.stations?.length ?? 0;
  const hasSurvey = surveyCount >= 2;

  const flatNodes = useMemo(
    () => (currentRecord ? flattenTree(currentRecord.tree) : []),
    [currentRecord],
  );
  const visibleNodes = useMemo(
    () => filterTreeNodes(flatNodes, treeListFilter, currentRecord?.tree),
    [flatNodes, treeListFilter, currentRecord?.tree],
  );
  const treeGroups = useMemo(
    () => groupTreeNodes(visibleNodes, currentRecord?.tree),
    [visibleNodes, currentRecord?.tree],
  );
  const { padTargets, externalTargets, allTargets } = useMemo(
    () => buildBottomholeTargetCatalog(infraObjects, padId, padLon, padLat),
    [infraObjects, padId, padLon, padLat],
  );
  const padBottomholes = useMemo(
    () => bottomholesLinkedToPad(infraObjects, padId),
    [infraObjects, padId],
  );
  const lateralTargetsForWell = useMemo(
    () => lateralBottomholeTargetsForWell(padBottomholes, selectedWellIndex, padLon, padLat),
    [padBottomholes, selectedWellIndex, padLon, padLat],
  );
  const selectableBottomholeTargets = useMemo(() => {
    if (lateralTargetsForWell.length > 0) return lateralTargetsForWell;
    const padLaterals = padTargets.filter((t) => t.isLateral);
    if (padLaterals.length > 0) return padLaterals;
    return allTargets.filter((t) => t.isLateral);
  }, [lateralTargetsForWell, padTargets, allTargets]);
  const bottomholeSelectOptions = useMemo(
    () => buildBottomholeSelectOptions(padTargets, externalTargets, selectedWellIndex),
    [padTargets, externalTargets, selectedWellIndex],
  );
  const selectedLateralTarget = useMemo(
    () => findBottomholeTargetById(allTargets, lateralBottomholeId),
    [allTargets, lateralBottomholeId],
  );
  const selectedNode = flatNodes.find((n) => JSON.stringify(n.path) === JSON.stringify(selectedPath))?.node;

  useEffect(() => {
    if (!onSelectedTreeNodeChange) return;
    if (!selectedNode) {
      onSelectedTreeNodeChange(null);
      return;
    }
    onSelectedTreeNodeChange({
      x: selectedNode.x,
      y: selectedNode.y,
      z: selectedNode.z,
      color: selectedNode.color,
    });
  }, [selectedNode, onSelectedTreeNodeChange]);

  const geometry = currentRecord?.geometry as
    | { length_m?: number; tvd_max?: number; md_max?: number }
    | undefined;

  const refreshPlot = useCallback(
    async (record = currentRecord) => {
      if (!record) {
        onPlotSegmentsChange?.([]);
        return;
      }
      try {
        const res = await pywellgeoApi.plotData(
          projectId,
          padId,
          record.well_index,
          record.tree,
        );
        onPlotSegmentsChange?.(res.segments);
      } catch {
        onPlotSegmentsChange?.([]);
      }
    },
    [projectId, padId, currentRecord, onPlotSegmentsChange],
  );

  useEffect(() => {
    if (plotDebounceRef.current) {
      clearTimeout(plotDebounceRef.current);
    }
    if (!currentRecord) {
      onPlotSegmentsChange?.([]);
      return;
    }
    plotDebounceRef.current = setTimeout(() => {
      void refreshPlot(currentRecord);
    }, 300);
    return () => {
      if (plotDebounceRef.current) {
        clearTimeout(plotDebounceRef.current);
      }
    };
  }, [currentRecord, refreshPlot, onPlotSegmentsChange]);

  useLayoutEffect(() => {
    selectedItemRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selectedPath]);

  useEffect(() => {
    if (lateralMode !== 'bottomhole') return;
    if (selectableBottomholeTargets.length === 0) {
      setLateralBottomholeId('');
      return;
    }
    setLateralBottomholeId((prev) => {
      if (prev && selectableBottomholeTargets.some((t) => t.id === prev)) return prev;
      return selectableBottomholeTargets[0]!.id;
    });
  }, [lateralMode, selectableBottomholeTargets, selectedWellIndex]);

  useEffect(() => {
    if (!onLateralTargetChange) return;
    if (lateralMode !== 'bottomhole' || !selectedLateralTarget) {
      onLateralTargetChange(null);
      return;
    }
    onLateralTargetChange({
      x: selectedLateralTarget.x,
      y: selectedLateralTarget.y,
      z: selectedLateralTarget.z,
      color: bottomholeTargetMarkerColor(selectedLateralTarget, selectedWellIndex),
    });
  }, [lateralMode, selectedLateralTarget, onLateralTargetChange, selectedWellIndex]);

  const updateCurrentTree = (
    tree: import('../../lib/api/pywellgeoApi').PyWellGeoTreeNode,
    extra?: Partial<typeof currentRecord>,
  ) => {
    const record = {
      well_index: selectedWellIndex,
      name: trajectories[selectedWellIndex]?.name,
      tree,
      source: currentRecord?.source ?? 'manual',
      ...extra,
    };
    patchDraft({ trees: upsertTree(draft.trees, record) });
  };

  const runAction = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const handleSyncFromSurvey = () =>
    runAction('sync', async () => {
      const res = await pywellgeoApi.syncFromSurvey(projectId, padId, selectedWellIndex);
      patchDraft({ trees: upsertTree(draft.trees, res.tree) });
      setSelectedPath([]);
      await refreshPlot(res.tree);
    });

  const handleCompute = () =>
    runAction('compute', async () => {
      if (!currentRecord) return;
      const res = await pywellgeoApi.compute(projectId, padId, selectedWellIndex, {
        tsurfaceC: draft.settings.tsurface_c,
        tgradCPerM: draft.settings.tgrad_c_per_m,
        tree: currentRecord.tree,
      });
      patchDraft({ trees: upsertTree(draft.trees, res.tree) });
      setTempProfile(res.temperature_profile);
      await refreshPlot(res.tree);
    });

  const handleApplyGeometry = () =>
    runAction('apply', async () => {
      if (!currentRecord) return;
      await pywellgeoApi.applyToGeometry(
        projectId,
        padId,
        selectedWellIndex,
        currentRecord.tree,
      );
    });

  const handleCoarsen = () =>
    runAction('coarsen', async () => {
      if (!currentRecord) return;
      const res = await pywellgeoApi.coarsen(projectId, padId, {
        well_index: selectedWellIndex,
        tree: currentRecord.tree,
        segment_length_m: draft.settings.coarsen_segment_length_m ?? 75,
      });
      patchDraft({ trees: upsertTree(draft.trees, res.tree) });
      setCoarsenHint(`${res.node_count_before} → ${res.node_count_after} узлов`);
      setSelectedPath([]);
      await refreshPlot(res.tree);
    });

  const handleAddLateral = () =>
    runAction('lateral', async () => {
      if (!currentRecord || !selectedNode) return;
      const kickoff = { x: selectedNode.x, y: selectedNode.y, z: selectedNode.z };
      if (lateralMode === 'bottomhole') {
        if (!lateralBottomholeId) throw new Error('Выберите целевой забой');
        const res = await pywellgeoApi.addBranch(projectId, padId, {
          well_index: selectedWellIndex,
          tree: currentRecord.tree,
          name: lateralName || 'lat1',
          color: lateralColor,
          radius_m: selectedNode.radius,
          design_with_welleng: true,
          kickoff_xyz: [kickoff.x, kickoff.y, kickoff.z],
          bottomhole_ref: lateralBottomholeId,
          dls_design: Number(lateralDlsDesign) || 3,
        });
        patchDraft({ trees: upsertTree(draft.trees, res.tree) });
        setLateralDesignHint(
          res.warnings?.length ? res.warnings.join(' · ') : 'Траектория welleng connector построена',
        );
        await refreshPlot(res.tree);
        return;
      }
      let xyz: number[][];
      if (lateralMode === 'azim_dip') {
        xyz = lateralXyzFromAzimDip(
          kickoff,
          Number(lateralAzim) || 0,
          Number(lateralDip) || 0,
          Number(lateralLength) || 100,
        );
      } else {
        xyz = parseXyzLines(lateralXyzText);
        if (xyz.length < 2) {
          throw new Error('Укажите минимум 2 точки XYZ (первая — kick-off на стволе)');
        }
      }
      const res = await pywellgeoApi.addBranch(projectId, padId, {
        well_index: selectedWellIndex,
        tree: currentRecord.tree,
        xyz,
        name: lateralName || 'lat1',
        color: lateralColor,
        radius_m: selectedNode.radius,
      });
      patchDraft({ trees: upsertTree(draft.trees, res.tree) });
      await refreshPlot(res.tree);
    });

  const handleYamlImport = (content: string) =>
    runAction('yaml', async () => {
      const res = await pywellgeoApi.importYaml(projectId, padId, {
        content,
        format: 'AUTO',
        well_index: selectedWellIndex,
      });
      patchDraft({ trees: upsertTree(draft.trees, res) });
      setYamlPreview(content.slice(0, 500));
      setYamlError(null);
      setSelectedPath([]);
      await refreshPlot(res);
    });

  const handleYamlExport = () =>
    runAction('export', async () => {
      if (!currentRecord) return;
      const res = await pywellgeoApi.exportYaml(
        projectId,
        padId,
        selectedWellIndex,
        draft.settings.yaml_format_default === 'DETAILEDTNO' ? 'DETAILEDTNO' : 'XYZGENERIC',
        wellLabel(selectedWellIndex, trajectories[selectedWellIndex]?.name),
        currentRecord.tree,
      );
      setYamlPreview(res.content);
      setYamlError(null);
    });

  const handleAzimDip = () =>
    runAction('azim', async () => {
      const body =
        azimMode === 'azim_dip_to_vector'
          ? { mode: azimMode, azim_deg: Number(azimDeg), dip_deg: Number(dipDeg) }
          : {
              mode: azimMode,
              vector: [Number(vecX), Number(vecY), Number(vecZ)],
            };
      const res = await pywellgeoApi.azimDipConvert(projectId, padId, body);
      if (res.vector) {
        setAzimResult(`vector: [${res.vector.map((v) => v.toFixed(4)).join(', ')}]`);
      } else {
        setAzimResult(`azim: ${res.azim_deg?.toFixed(2)}°, dip: ${res.dip_deg?.toFixed(2)}°`);
      }
    });

  const handleWater = () =>
    runAction('water', async () => {
      const res = await pywellgeoApi.waterProperties(projectId, padId, {
        temperature_c: draft.settings.tsurface_c + 50,
        depth_m: 1500,
        salinity_ppm: 0,
      });
      setWaterResult(
        Object.entries(res.values)
          .map(([k, v]) => `${k}: ${v.toExponential(3)} ${res.units[k] ?? ''}`)
          .join(' · '),
      );
    });

  const handleDc1d = () =>
    runAction('dc1d', async () => {
      const res = await pywellgeoApi.dc1dBuild(projectId, padId, {
        well_index: selectedWellIndex,
        tsurface: draft.settings.tsurface_c,
        tgrad: draft.settings.tgrad_c_per_m,
      });
      patchDraft({ trees: upsertTree(draft.trees, res) });
      setSelectedPath([]);
      await refreshPlot(res);
    });

  const handleCoordTransform = () =>
    runAction('coord', async () => {
      const points = coordPoints
        .trim()
        .split('\n')
        .map((line) => line.split(',').map((v) => Number(v.trim())))
        .filter((p) => p.length === 3 && p.every((n) => Number.isFinite(n)));
      const res = await pywellgeoApi.coordinateTransform(projectId, padId, {
        plane_azim_deg: Number(azimDeg) || 0,
        plane_dip_deg: Number(dipDeg) || 0,
        points,
        direction: 'global_to_local',
      });
      setCoordResult(res.points.map((p) => p.map((v) => v.toFixed(2)).join(', ')).join('\n'));
    });

  const patchNode = (patch: Partial<import('../../lib/api/pywellgeoApi').PyWellGeoTreeNode>) => {
    if (!currentRecord) return;
    const tree = setNodeAtPath(currentRecord.tree, selectedPath, patch);
    updateCurrentTree(tree);
  };

  const statusBadge = currentRecord?.geometry
    ? { label: 'Геометрия', tone: 'ok' as const }
    : currentRecord
      ? { label: 'Дерево', tone: 'warn' as const }
      : hasSurvey
        ? { label: 'Survey', tone: 'warn' as const }
        : { label: 'Нет данных', tone: 'warn' as const };

  return (
    <div className="pad-clustering-geo-panel">
      {busy ? (
        <div className="pad-clustering-geo-panel__busy" role="status" aria-live="polite">
          <Loader2 size={14} className="animate-spin" aria-hidden />
          <span>Выполняется…</span>
        </div>
      ) : null}

      {error ? (
        <div className="pad-clustering-geo-panel__alert pad-clustering-geo-panel__alert--error" role="alert">
          {error}
        </div>
      ) : null}

      <div className="pad-clustering-geo-hero">
        <div className="pad-clustering-geo-hero__head">
          <div className="pad-clustering-geo-hero__brand">
            <span className="pad-clustering-geo-hero__icon" aria-hidden>
              <GitBranch size={18} strokeWidth={2} />
            </span>
            <div>
              <h3 className="pad-clustering-geo-hero__title">PyWellGeo</h3>
              <span className="pad-clustering-geo-hero__subtitle">GPL · WellTree · AHD</span>
            </div>
          </div>
          <span className={`pad-clustering-badge pad-clustering-badge--${statusBadge.tone}`}>
            {statusBadge.label}
          </span>
        </div>

        <label className="pad-clustering-geo-hero__well">
          <span className="pad-clustering-geo-hero__well-label">Скважина куста</span>
          <AppSelect
            value={String(selectedWellIndex)}
            onChange={(v) => onSelectWell(Number(v))}
            options={wellOptions}
            disabled={readOnly}
            fullWidth
          />
        </label>

        <p className="pad-clustering-geo-hero__hint">
          {hasSurvey
            ? `${surveyCount} станций survey · clearance не меняется при правке дерева`
            : 'Сначала «Рассчитать до забоя» на вкладке «Куст»'}
        </p>
      </div>

      <ol className="pad-clustering-steps pad-clustering-geo-steps">
        <li className={hasSurvey ? 'pad-clustering-steps__item--done' : ''}>
          <span className="pad-clustering-steps__num">1</span>
          <div>
            <strong>Survey → дерево</strong>
            <p>{hasSurvey ? 'Импорт из welleng' : 'Нужен survey ≥2 станций'}</p>
          </div>
          <GeoActionButton
            variant="primary"
            icon={<Download size={14} aria-hidden />}
            label="Из survey"
            loadingLabel="…"
            loading={busy === 'sync'}
            disabled={readOnly || !!busy || !hasSurvey}
            onClick={() => void handleSyncFromSurvey()}
          />
        </li>
        <li className={currentRecord ? 'pad-clustering-steps__item--done' : ''}>
          <span className="pad-clustering-steps__num">2</span>
          <div>
            <strong>Пересчёт AHD</strong>
            <p>{currentRecord ? `${flatNodes.length} узлов · T(z)` : 'Создайте дерево'}</p>
            {coarsenHint ? <p className="pad-clustering-steps__hint">{coarsenHint}</p> : null}
          </div>
          <div className="pad-clustering-geo-steps__actions">
            <GeoActionButton
              variant="secondary"
              icon={
                <RefreshCw
                  size={14}
                  aria-hidden
                  className={busy === 'compute' ? 'animate-spin' : undefined}
                />
              }
              label="Пересчитать"
              loadingLabel="…"
              loading={busy === 'compute'}
              disabled={readOnly || !!busy || !currentRecord}
              onClick={() => void handleCompute()}
            />
            <GeoActionButton
              variant="ghost"
              icon={<Minimize2 size={14} aria-hidden />}
              label="Упростить"
              loadingLabel="…"
              loading={busy === 'coarsen'}
              disabled={readOnly || !!busy || !currentRecord}
              title="Coarsen: меньше узлов для kick-off"
              onClick={() => void handleCoarsen()}
            />
          </div>
        </li>
        <li className={geometry ? 'pad-clustering-steps__item--done' : ''}>
          <span className="pad-clustering-steps__num">3</span>
          <div>
            <strong>Geometry</strong>
            <p>{geometry ? `AHD ${geometry.length_m?.toFixed(0) ?? '—'} м` : 'Запись в trajectories JSON'}</p>
          </div>
          <GeoActionButton
            variant="secondary"
            accent
            icon={<Link2 size={14} aria-hidden />}
            label="Записать"
            loadingLabel="…"
            loading={busy === 'apply'}
            disabled={readOnly || !!busy || !currentRecord}
            onClick={() => void handleApplyGeometry()}
          />
        </li>
      </ol>

      <PadClusteringCollapsibleSection
        id="geo-tree"
        title="Дерево WellTree"
        icon={<Layers size={15} />}
        badge={
          currentRecord ? (
            <span className="pad-clustering-badge">{flatNodes.length} узл.</span>
          ) : null
        }
        hint="x/y/z в системе куста; z = −TVD."
        defaultOpen
      >
        {!currentRecord ? (
          <div className="pad-clustering-geo-panel__empty-card">
            <Layers size={28} strokeWidth={1.5} className="pad-clustering-geo-empty-icon" aria-hidden />
            <p><strong>Дерево WellTree ещё не создано</strong></p>
            <p className="pad-clustering-geo-panel__empty">
              Импортируйте траекторию из рассчитанного survey welleng — узлы появятся здесь и на 3D-сцене.
            </p>
            <Button
              type="primary"
              size="small"
              disabled={readOnly || !hasSurvey || !!busy}
              onClick={() => void handleSyncFromSurvey()}
            >
              Импортировать из survey
            </Button>
          </div>
        ) : (
          <div className="pad-clustering-geo-tree-workspace">
            <div className="pad-clustering-geo-tree-pane pad-clustering-geo-tree-pane--list">
              <div className="pad-clustering-geo-tree-pane__head">
                <span className="pad-clustering-geo-tree-pane__title">Узлы</span>
                <span className="pad-clustering-badge">{visibleNodes.length}</span>
              </div>
              <div className="pad-clustering-geo-tree-list-toolbar" role="tablist" aria-label="Фильтр узлов">
                {TREE_FILTER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    role="tab"
                    aria-selected={treeListFilter === opt.value}
                    className={`pad-clustering-geo-filter-pill${
                      treeListFilter === opt.value ? ' pad-clustering-geo-filter-pill--active' : ''
                    }`}
                    onClick={() => setTreeListFilter(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div
                ref={treeListRef}
                className="pad-clustering-geo-tree-list"
                role="listbox"
                aria-label="Узлы дерева"
              >
              {treeGroups.map((group) => (
                <details key={group.id} className="pad-clustering-geo-tree-group" open>
                  <summary className="pad-clustering-geo-tree-group__title">
                    {group.title}
                    <span className="pad-clustering-badge">{group.nodes.length}</span>
                  </summary>
                  {group.nodes.map(({ path, node }) => {
                    const active = JSON.stringify(path) === JSON.stringify(selectedPath);
                    return (
                      <button
                        key={path.join('-') || 'root'}
                        ref={active ? (el) => { selectedItemRef.current = el; } : undefined}
                        type="button"
                        role="option"
                        aria-selected={active}
                        title={nodeListHint(path, node)}
                        className={`pad-clustering-geo-tree-list__item${active ? ' pad-clustering-geo-tree-list__item--active' : ''}`}
                        onClick={() => setSelectedPath(path)}
                      >
                        <span className="pad-clustering-geo-tree-list__depth" aria-hidden>
                          {path.length > 0 ? path.length : '·'}
                        </span>
                        <span className="pad-clustering-geo-tree-list__meta">
                          <span
                            className="pad-clustering-geo-tree-list__swatch"
                            style={{ background: branchColorCss(node.color) }}
                            aria-hidden
                          />
                          <span className="pad-clustering-geo-tree-list__label">{nodeListTitle(path, node)}</span>
                          {node.name && node.name !== 'main' ? (
                            <span className="pad-clustering-geo-tree-list__name">{node.name}</span>
                          ) : null}
                          {node.perforated ? (
                            <span className="pad-clustering-geo-tree-list__perf">перф.</span>
                          ) : null}
                        </span>
                        <span className="pad-clustering-geo-tree-list__coords">
                          {node.x.toFixed(0)}, {node.y.toFixed(0)}, {node.z.toFixed(0)}
                        </span>
                      </button>
                    );
                  })}
                </details>
              ))}
            </div>
            </div>

            <div className="pad-clustering-geo-tree-pane pad-clustering-geo-tree-pane--editor">
              <div className="pad-clustering-geo-tree-pane__head">
                <span className="pad-clustering-geo-tree-pane__title">
                  {selectedNode ? nodeListTitle(selectedPath, selectedNode) : 'Редактор'}
                </span>
              </div>
            <div className="pad-clustering-geo-tree-editor">
            {selectedNode ? (
              <>
              <GeoSubsection title="Координаты и свойства">
                {(['x', 'y', 'z'] as const).map((axis) => (
                  <GeoField key={axis} label={`${axis.toUpperCase()}, м`}>
                    <Input
                      type="number"
                      step="any"
                      disabled={readOnly}
                      value={selectedNode[axis]}
                      onChange={(e) => patchNode({ [axis]: Number(e.target.value) })}
                    />
                  </GeoField>
                ))}
                <GeoField label="Радиус, м">
                  <Input
                    type="number"
                    step="any"
                    disabled={readOnly}
                    value={selectedNode.radius}
                    onChange={(e) => patchNode({ radius: Number(e.target.value) })}
                  />
                </GeoField>
                <GeoField label="Цвет ветки">
                  <AppSelect
                    value={selectedNode.color}
                    disabled={readOnly}
                    onChange={(v) => patchNode({ color: v })}
                    options={BRANCH_COLORS}
                    fullWidth
                  />
                </GeoField>
                <GeoField label="Перфорация">
                  <label className="pad-clustering-geo-toggle">
                    <input
                      type="checkbox"
                      disabled={readOnly}
                      checked={selectedNode.perforated}
                      onChange={(e) => patchNode({ perforated: e.target.checked })}
                    />
                    <span>{selectedNode.perforated ? 'Да' : 'Нет'}</span>
                  </label>
                </GeoField>
                <GeoField label="Имя ветки">
                  <Input
                    disabled={readOnly}
                    value={selectedNode.name}
                    onChange={(e) => patchNode({ name: e.target.value })}
                  />
                </GeoField>
                <div className="pad-clustering-geo-panel__action-bar pad-clustering-field--span2">
                  {selectedPath.length > 0 ? (
                    <Button
                      type="text"
                      size="small"
                      disabled={readOnly}
                      onClick={() => {
                        updateCurrentTree(removeBranchAtPath(currentRecord.tree, selectedPath));
                        setSelectedPath([]);
                      }}
                    >
                      Удалить ветку
                    </Button>
                  ) : null}
                </div>
              </GeoSubsection>

              <GeoSubsection title="Боковой ствол (add_xyz)">
                <GeoField label="Режим" span={2}>
                  <AppSelect
                    value={lateralMode}
                    onChange={(v) => setLateralMode(v as LateralMode)}
                    options={[
                      { value: 'bottomhole', label: 'До забоя' },
                      { value: 'azim_dip', label: 'Азимут + dip + длина' },
                      { value: 'xyz', label: 'Точки XYZ' },
                    ]}
                    fullWidth
                  />
                </GeoField>
                <GeoField label="Имя lateral">
                  <Input
                    disabled={readOnly}
                    value={lateralName}
                    onChange={(e) => setLateralName(e.target.value)}
                  />
                </GeoField>
                <GeoField label="Цвет">
                  <AppSelect
                    value={lateralColor}
                    disabled={readOnly}
                    onChange={setLateralColor}
                    options={BRANCH_COLORS}
                    fullWidth
                  />
                </GeoField>
                {lateralMode === 'azim_dip' ? (
                  <>
                    <GeoField label="Azim, °">
                      <Input disabled={readOnly} value={lateralAzim} onChange={(e) => setLateralAzim(e.target.value)} />
                    </GeoField>
                    <GeoField label="Dip, °">
                      <Input disabled={readOnly} value={lateralDip} onChange={(e) => setLateralDip(e.target.value)} />
                    </GeoField>
                    <GeoField label="Длина, м">
                      <Input disabled={readOnly} value={lateralLength} onChange={(e) => setLateralLength(e.target.value)} />
                    </GeoField>
                  </>
                ) : null}
                {lateralMode === 'xyz' ? (
                  <GeoField label="XYZ (kick-off = первая точка)" span={2}>
                    <Input.TextArea
                      className="pad-clustering-geo-textarea"
                      rows={3}
                      disabled={readOnly}
                      placeholder="0,0,-1500&#10;50,0,-1500&#10;100,0,-1600"
                      value={lateralXyzText}
                      onChange={(e) => setLateralXyzText(e.target.value)}
                    />
                  </GeoField>
                ) : null}
                {lateralMode === 'bottomhole' ? (
                  <GeoField
                    label="Целевой забой"
                    hint={`Welleng connector от kick-off до забоя (NNB или ГС ${GS_HEEL_LABEL}/${GS_TOE_LABEL}). SF — только по основному стволу.`}
                    span={2}
                  >
                    <AppSelect
                      value={lateralBottomholeId}
                      onChange={setLateralBottomholeId}
                      disabled={readOnly || allTargets.length === 0}
                      placeholder={
                        allTargets.length > 0 ? 'Выберите забой' : 'Нет забоев в проекте'
                      }
                      options={
                        allTargets.length > 0
                          ? bottomholeSelectOptions
                          : [{ value: '', label: 'Нет забоев в проекте', disabled: true }]
                      }
                      fullWidth
                    />
                    {externalTargets.length > 0 ? (
                      <p className="pad-clustering-geo-panel__empty">
                        Внешние забои не участвуют в welleng design/SF — только геометрия PyWellGeo.
                      </p>
                    ) : null}
                    {allTargets.length === 0 ? (
                      <p className="pad-clustering-geo-panel__empty">
                        Создайте забой на карте или используйте режим «Точки XYZ» для произвольной цели.
                      </p>
                    ) : null}
                  </GeoField>
                ) : null}
                {lateralMode === 'bottomhole' ? (
                  <GeoField
                    label="DLS проектирования, °/30m"
                    hint="Целевая кривизна welleng connector; меньше — положе траектория (default 3)."
                  >
                    <Input
                      type="number"
                      min={0.1}
                      max={30}
                      step={0.1}
                      disabled={readOnly}
                      value={lateralDlsDesign}
                      onChange={(e) => setLateralDlsDesign(e.target.value)}
                    />
                  </GeoField>
                ) : null}
                <div className="pad-clustering-geo-panel__action-bar pad-clustering-field--span2">
                  <Button
                    type="primary"
                    size="small"
                    disabled={readOnly || !!busy}
                    onClick={() => void handleAddLateral()}
                  >
                    Добавить боковой ствол
                  </Button>
                </div>
                <p className="pad-clustering-geo-panel__empty pad-clustering-field--span2">
                  Kick-off: узел «{nodeListTitle(selectedPath, selectedNode)}». Clearance welleng по-прежнему только по survey.
                  {lateralDesignHint ? ` ${lateralDesignHint}` : ''}
                </p>
              </GeoSubsection>
              </>
            ) : (
              <div className="pad-clustering-geo-tree-editor__placeholder">
                <ChevronRight size={20} aria-hidden className="pad-clustering-geo-empty-icon" />
                <p>Выберите узел в списке слева для редактирования или добавления бокового ствола.</p>
              </div>
            )}
            </div>
            </div>
          </div>
        )}
      </PadClusteringCollapsibleSection>

      {(geometry || currentRecord) && (
        <PadClusteringCollapsibleSection
          id="geo-geometry"
          title="Геометрия"
          icon={<Compass size={15} />}
          hint="AHD и длины веток PyWellGeo."
          defaultOpen
        >
          {geometry ? (
            <div className="pad-clustering-geo-stats">
              <div className="pad-clustering-geo-stat pad-clustering-geo-stat--primary">
                <span className="pad-clustering-geo-stat__label">AHD</span>
                <span className="pad-clustering-geo-stat__value">
                  {geometry.length_m?.toFixed(1) ?? '—'} <small>м</small>
                </span>
              </div>
              <div className="pad-clustering-geo-stat">
                <span className="pad-clustering-geo-stat__label">TVD max</span>
                <span className="pad-clustering-geo-stat__value">
                  {geometry.tvd_max?.toFixed(1) ?? '—'} <small>м</small>
                </span>
              </div>
              <div className="pad-clustering-geo-stat">
                <span className="pad-clustering-geo-stat__label">MD max</span>
                <span className="pad-clustering-geo-stat__value">
                  {geometry.md_max?.toFixed(1) ?? '—'} <small>м</small>
                </span>
              </div>
            </div>
          ) : (
            <p className="pad-clustering-geo-panel__empty pad-clustering-geo-panel__empty--inset">
              Нажмите «Пересчитать» в шаге 2, чтобы получить AHD и статистику веток.
            </p>
          )}
          {currentRecord?.branch_stats?.length ? (
            <ul className="pad-clustering-geo-branch-stats">
              {currentRecord.branch_stats.map((b) => (
                <li key={String(b.name)}>
                  <span>{String(b.name)}</span>
                  <span>{(b.length_m as number)?.toFixed?.(1) ?? b.length_m} м</span>
                </li>
              ))}
            </ul>
          ) : null}
        </PadClusteringCollapsibleSection>
      )}

      <PadClusteringCollapsibleSection
        id="geo-yaml"
        title="YAML"
        icon={<FileCode size={15} />}
        hint="XYZGENERIC, DETAILEDTNO, DC1D."
        defaultOpen={false}
      >
        <GeoActionBar layout="grid" title="Файл WellTree">
          <AntUpload
            showUploadList={false}
            accept=".yml,.yaml"
            disabled={readOnly}
            beforeUpload={(file) => {
              const reader = new FileReader();
              reader.onload = () => {
                const text = String(reader.result ?? '');
                void handleYamlImport(text).catch(() => {
                  setYamlError('Ошибка импорта YAML');
                });
              };
              reader.readAsText(file);
              return false;
            }}
          >
            <Button
              size="small"
              block
              className="pad-clustering-geo-file-btn pad-clustering-geo-action-btn pad-clustering-geo-action-btn--full"
              icon={<Upload size={14} />}
            >
              Импорт .yml
            </Button>
          </AntUpload>
          <GeoActionButton
            variant="ghost"
            fullWidth
            icon={<Download size={14} aria-hidden />}
            label="Экспорт"
            loading={busy === 'export'}
            disabled={readOnly || !!busy || !currentRecord}
            onClick={() => void handleYamlExport()}
          />
        </GeoActionBar>
        {yamlError ? (
          <div className="pad-clustering-geo-panel__alert pad-clustering-geo-panel__alert--error">{yamlError}</div>
        ) : null}
        {yamlPreview ? <pre className="pad-clustering-geo-yaml-preview">{yamlPreview.slice(0, 1200)}</pre> : null}
      </PadClusteringCollapsibleSection>

      <PadClusteringCollapsibleSection
        id="geo-azim"
        title="Азимут и координаты"
        icon={<Compass size={15} />}
        hint="Конвенция PyWellGeo ≠ welleng NDS без пересчёта."
        defaultOpen={false}
      >
        <GeoSubsection title="AzimDip">
          <GeoField label="Режим" span={2}>
            <AppSelect
              value={azimMode}
              onChange={(v) => setAzimMode(v as typeof azimMode)}
              options={[
                { value: 'azim_dip_to_vector', label: 'azim/dip → vector' },
                { value: 'vector_to_azim_dip', label: 'vector → azim/dip' },
              ]}
              fullWidth
            />
          </GeoField>
          {azimMode === 'azim_dip_to_vector' ? (
            <>
              <GeoField label="Azim, °">
                <Input value={azimDeg} onChange={(e) => setAzimDeg(e.target.value)} />
              </GeoField>
              <GeoField label="Dip, °">
                <Input value={dipDeg} onChange={(e) => setDipDeg(e.target.value)} />
              </GeoField>
            </>
          ) : (
            <>
              <GeoField label="X">
                <Input value={vecX} onChange={(e) => setVecX(e.target.value)} />
              </GeoField>
              <GeoField label="Y">
                <Input value={vecY} onChange={(e) => setVecY(e.target.value)} />
              </GeoField>
              <GeoField label="Z">
                <Input value={vecZ} onChange={(e) => setVecZ(e.target.value)} />
              </GeoField>
            </>
          )}
          <div className="pad-clustering-geo-panel__action-bar pad-clustering-field--span2">
            <Button size="small" onClick={() => void handleAzimDip()}>
              Конвертировать
            </Button>
          </div>
          {azimResult ? <p className="pad-clustering-geo-panel__result">{azimResult}</p> : null}
        </GeoSubsection>
        <GeoSubsection title="ENU → локальные">
          <GeoField label="Точки x,y,z (построчно)" span={2}>
            <Input.TextArea
              className="pad-clustering-geo-textarea"
              rows={3}
              value={coordPoints}
              onChange={(e) => setCoordPoints(e.target.value)}
            />
          </GeoField>
          <Button type="text" size="small" onClick={() => void handleCoordTransform()}>
            global → local
          </Button>
          {coordResult ? <pre className="pad-clustering-geo-yaml-preview">{coordResult}</pre> : null}
        </GeoSubsection>
      </PadClusteringCollapsibleSection>

      <PadClusteringCollapsibleSection
        id="geo-thermal"
        title="Тепло и флюиды"
        icon={<Thermometer size={15} />}
        hint="T(z), DC1D, свойства воды."
        defaultOpen={false}
      >
        <GeoSubsection title="Профиль T(z)">
          {tempProfile.length > 0 ? (
            <div className="pad-clustering-geo-temp-chart" role="img" aria-label="Профиль температуры">
              {tempProfile.map((p) => (
                <div
                  key={p.depth_m}
                  className="pad-clustering-geo-temp-bar"
                  style={{
                    height: `${Math.min(100, (p.temp_c / Math.max(...tempProfile.map((x) => x.temp_c), 1)) * 100)}%`,
                    left: `${Math.min(98, (p.depth_m / (tempProfile.at(-1)?.depth_m || 1)) * 100)}%`,
                  }}
                  title={`${p.depth_m.toFixed(0)} m: ${p.temp_c.toFixed(1)} °C`}
                />
              ))}
            </div>
          ) : (
            <p className="pad-clustering-geo-panel__empty">Нажмите «Пересчитать» для профиля температуры в породе.</p>
          )}
        </GeoSubsection>
        <GeoActionBar layout="grid">
          <GeoActionButton
            variant="secondary"
            fullWidth
            label="Построить DC1D"
            loading={busy === 'dc1d'}
            disabled={readOnly || !!busy}
            onClick={() => void handleDc1d()}
          />
          <GeoActionButton
            variant="ghost"
            fullWidth
            label="Свойства воды"
            loading={busy === 'water'}
            disabled={!!busy}
            onClick={() => void handleWater()}
          />
        </GeoActionBar>
        {waterResult ? <p className="pad-clustering-geo-panel__result">{waterResult}</p> : null}
      </PadClusteringCollapsibleSection>

      <PadClusteringCollapsibleSection
        id="geo-settings"
        title="Настройки куста"
        icon={<Settings2 size={15} />}
        hint="Defaults для всех скважин PyWellGeo."
        defaultOpen={false}
      >
        <GeoSubsection title="По умолчанию">
          <GeoField label="Радиус ствола, м">
            <Input
              type="number"
              step="any"
              disabled={readOnly}
              value={draft.settings.default_radius_m}
              onChange={(e) =>
                patchDraft({
                  settings: { ...draft.settings, default_radius_m: Number(e.target.value) },
                })
              }
            />
          </GeoField>
          <GeoField label="Tsurface, °C">
            <Input
              type="number"
              step="any"
              disabled={readOnly}
              value={draft.settings.tsurface_c}
              onChange={(e) =>
                patchDraft({ settings: { ...draft.settings, tsurface_c: Number(e.target.value) } })
              }
            />
          </GeoField>
          <GeoField label="Градиент, °C/м">
            <Input
              type="number"
              step="any"
              disabled={readOnly}
              value={draft.settings.tgrad_c_per_m}
              onChange={(e) =>
                patchDraft({ settings: { ...draft.settings, tgrad_c_per_m: Number(e.target.value) } })
              }
            />
          </GeoField>
          <GeoField label="Шаг coarsen, м">
            <Input
              type="number"
              step="any"
              disabled={readOnly}
              value={draft.settings.coarsen_segment_length_m ?? 75}
              onChange={(e) =>
                patchDraft({
                  settings: { ...draft.settings, coarsen_segment_length_m: Number(e.target.value) },
                })
              }
            />
          </GeoField>
          <GeoField label="Формат YAML">
            <AppSelect
              value={draft.settings.yaml_format_default}
              disabled={readOnly}
              onChange={(v) =>
                patchDraft({
                  settings: {
                    ...draft.settings,
                    yaml_format_default: v as PadClusteringPyWellGeoDraft['settings']['yaml_format_default'],
                  },
                })
              }
              options={[
                { value: 'XYZGENERIC', label: 'XYZGENERIC' },
                { value: 'DETAILEDTNO', label: 'DETAILEDTNO' },
                { value: 'DC1D', label: 'DC1D' },
              ]}
              fullWidth
            />
          </GeoField>
        </GeoSubsection>
      </PadClusteringCollapsibleSection>
    </div>
  );
}
