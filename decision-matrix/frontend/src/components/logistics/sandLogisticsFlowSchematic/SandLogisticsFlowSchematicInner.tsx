import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SandLogisticsSubnet } from '../../../lib/api';
import { formatEntryDateRu } from '../../../lib/infraEntryDate';
import {
  buildSandLogisticsLayout,
  buildSandLogisticsSliceFlow,
  computeSandLogisticsSliceKey,
  computeSandLogisticsTopologyKey,
  type SandLogisticsEdgeLabelMode,
  type SandLogisticsLineStyle,
  type SandLogisticsNodeFilterMode,
} from '../../../lib/sandLogisticsFlow';
import {
  loadSandLogisticsEdgeLabelMode,
  loadSandLogisticsGroupByEntryYear,
  loadSandLogisticsLineStyle,
  loadSandLogisticsNodeFilterMode,
  loadSandLogisticsShowPlannedRoutes,
  saveSandLogisticsEdgeLabelMode,
  saveSandLogisticsGroupByEntryYear,
  saveSandLogisticsLineStyle,
  saveSandLogisticsNodeFilterMode,
  saveSandLogisticsShowPlannedRoutes,
} from '../../../lib/sandLogisticsResult';
import { useIsMobile } from '../../../hooks/useMediaQuery';
import { useFlowSchematicContext } from '../../../pages/flows/flowSchematicContext';
import { SandLogisticsSchematicTimeline } from '../SandLogisticsSchematicTimeline';
import { SandLogisticsFlowCanvas } from './SandLogisticsFlowCanvas';
import { EntryYearLegend, SandSchematicLegend } from './SandSchematicLegend';

export function SandLogisticsFlowSchematicInner({
  layoutSubnet,
  sliceSubnet,
  asOf,
  horizonFrom,
  horizonTo,
  viewAsOf,
  onViewAsOfChange,
}: {
  layoutSubnet: SandLogisticsSubnet;
  sliceSubnet: SandLogisticsSubnet;
  asOf?: string;
  horizonFrom?: string;
  horizonTo?: string;
  viewAsOf?: string;
  onViewAsOfChange?: (next: string) => void;
}) {
  const { projectId } = useFlowSchematicContext();
  const isMobile = useIsMobile();
  const timelineViewActive = Boolean(horizonFrom && horizonTo && viewAsOf && onViewAsOfChange);
  const topologyKey = useMemo(
    () => computeSandLogisticsTopologyKey(layoutSubnet),
    [layoutSubnet],
  );
  const sliceKey = useMemo(
    () => computeSandLogisticsSliceKey(sliceSubnet, asOf),
    [sliceSubnet, asOf],
  );
  const [lineStyle, setLineStyle] = useState<SandLogisticsLineStyle>(() =>
    projectId ? loadSandLogisticsLineStyle(projectId) : 'straight'
  );
  const [edgeLabelMode, setEdgeLabelMode] = useState<SandLogisticsEdgeLabelMode>(() =>
    projectId ? loadSandLogisticsEdgeLabelMode(projectId) : 'key'
  );
  const [nodeFilter, setNodeFilter] = useState<SandLogisticsNodeFilterMode>(() =>
    projectId ? loadSandLogisticsNodeFilterMode(projectId) : 'all_planned'
  );
  const [showPlannedRoutes, setShowPlannedRoutes] = useState(() =>
    projectId ? loadSandLogisticsShowPlannedRoutes(projectId) : true
  );
  const [groupByEntryYear, setGroupByEntryYear] = useState(() =>
    projectId ? loadSandLogisticsGroupByEntryYear(projectId) : false
  );

  useEffect(() => {
    if (!projectId) return;
    setLineStyle(loadSandLogisticsLineStyle(projectId));
    setEdgeLabelMode(loadSandLogisticsEdgeLabelMode(projectId));
    setNodeFilter(loadSandLogisticsNodeFilterMode(projectId));
    setShowPlannedRoutes(loadSandLogisticsShowPlannedRoutes(projectId));
    setGroupByEntryYear(loadSandLogisticsGroupByEntryYear(projectId));
  }, [projectId]);

  const flowNodeFilter = timelineViewActive ? 'all_planned' : nodeFilter;

  const layout = useMemo(
    () =>
      buildSandLogisticsLayout(layoutSubnet, {
        nodeFilter: flowNodeFilter,
        groupByEntryYear,
      }),
    [layoutSubnet, topologyKey, flowNodeFilter, groupByEntryYear],
  );

  const built = useMemo(() => {
    try {
      return buildSandLogisticsSliceFlow(layout, sliceSubnet, {
        edgeLabelMode,
        nodeFilter: flowNodeFilter,
        showPlannedRoutes,
        as_of: asOf,
      });
    } catch (error) {
      console.error('buildSandLogisticsSliceFlow failed', error);
      throw error;
    }
  }, [
    layout,
    sliceSubnet,
    sliceKey,
    edgeLabelMode,
    flowNodeFilter,
    showPlannedRoutes,
    asOf,
  ]);
  const {
    summary,
    nodes: initialNodes,
    edges: initialEdges,
    entryYears,
    siteNodeIds,
    defaultViewport,
  } = built;

  const layoutKey = useMemo(
    () =>
      [
        topologyKey,
        flowNodeFilter,
        edgeLabelMode,
        showPlannedRoutes ? '1' : '0',
        groupByEntryYear ? '1' : '0',
      ].join('|'),
    [topologyKey, flowNodeFilter, edgeLabelMode, showPlannedRoutes, groupByEntryYear],
  );

  const handleLineStyleChange = useCallback(
    (style: SandLogisticsLineStyle) => {
      setLineStyle(style);
      if (projectId) saveSandLogisticsLineStyle(projectId, style);
    },
    [projectId]
  );

  const handleEdgeLabelModeChange = useCallback(
    (mode: SandLogisticsEdgeLabelMode) => {
      setEdgeLabelMode(mode);
      if (projectId) saveSandLogisticsEdgeLabelMode(projectId, mode);
    },
    [projectId]
  );

  const handleNodeFilterChange = useCallback(
    (mode: SandLogisticsNodeFilterMode) => {
      setNodeFilter(mode);
      if (projectId) saveSandLogisticsNodeFilterMode(projectId, mode);
    },
    [projectId]
  );

  const handleShowPlannedRoutesChange = useCallback(
    (value: boolean) => {
      setShowPlannedRoutes(value);
      if (projectId) saveSandLogisticsShowPlannedRoutes(projectId, value);
    },
    [projectId]
  );

  const handleGroupByEntryYearChange = useCallback(
    (value: boolean) => {
      setGroupByEntryYear(value);
      if (projectId) saveSandLogisticsGroupByEntryYear(projectId, value);
    },
    [projectId]
  );

  if (
    layoutSubnet.quarries.length === 0 &&
    layoutSubnet.consumers.length === 0 &&
    (layoutSubnet.network_nodes?.length ?? 0) === 0
  ) {
    return (
      <p className="text-sm text-[var(--text-muted)] py-6 text-center">
        Нет карьеров и потребителей для схемы движения.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-4 text-sm">
        <span>
          Спрос: <strong>{summary.total_demand_m3.toLocaleString('ru-RU')} м³</strong>
        </span>
        <span>
          Отгружено: <strong>{summary.total_allocated_m3.toLocaleString('ru-RU')} м³</strong>
        </span>
        {summary.unmet_m3 > 0 && (
          <span className="text-amber-700">
            Не покрыто: <strong>{summary.unmet_m3.toLocaleString('ru-RU')} м³</strong>
          </span>
        )}
      </div>
      {asOf && !(horizonFrom && horizonTo && viewAsOf && onViewAsOfChange) && (
        <p className="text-sm font-medium">
          Срез на {formatEntryDateRu(asOf)} · жадное распределение (накопительно)
        </p>
      )}
      {horizonFrom && horizonTo && viewAsOf && onViewAsOfChange && (
        <SandLogisticsSchematicTimeline
          subnet={layoutSubnet}
          horizonFrom={horizonFrom}
          horizonTo={horizonTo}
          viewAsOf={viewAsOf}
          onViewAsOfChange={onViewAsOfChange}
        />
      )}
      <SandSchematicLegend />
      {groupByEntryYear && <EntryYearLegend years={entryYears} />}

      <SandLogisticsFlowCanvas
        key={layoutKey}
        initialNodes={initialNodes}
        initialEdges={initialEdges}
        siteNodeIds={siteNodeIds}
        defaultViewport={defaultViewport}
        isMobile={isMobile}
        lineStyle={lineStyle}
        edgeLabelMode={edgeLabelMode}
        nodeFilter={nodeFilter}
        showPlannedRoutes={showPlannedRoutes}
        groupByEntryYear={groupByEntryYear}
        onLineStyleChange={handleLineStyleChange}
        onEdgeLabelModeChange={handleEdgeLabelModeChange}
        onNodeFilterChange={handleNodeFilterChange}
        onShowPlannedRoutesChange={handleShowPlannedRoutesChange}
        onGroupByEntryYearChange={handleGroupByEntryYearChange}
      />
    </div>
  );
}
