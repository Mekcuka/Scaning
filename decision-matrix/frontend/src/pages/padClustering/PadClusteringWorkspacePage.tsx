import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Settings2 } from 'lucide-react';

import { PadClusteringBottomholesSection } from '../../components/padClustering/PadClusteringBottomholesSection';
import { PadClusteringCalculationPanel } from '../../components/padClustering/PadClusteringCalculationPanel';
import { PadClusteringPyWellGeoPanel } from '../../components/padClustering/PadClusteringPyWellGeoPanel';
import { PadClusteringScene3DLayerToggles } from '../../components/padClustering/PadClusteringScene3DLayerToggles';
import {
  PadClusteringScene3D,
  type PadClusteringScene3DHandle,
} from '../../components/padClustering/PadClusteringScene3D';
import { PadClusteringSettingsPanel } from '../../components/padClustering/PadClusteringSettingsPanel';
import {
  PadClusteringSidebarTabs,
  type PadClusteringSidebarTab,
} from '../../components/padClustering/PadClusteringSidebarTabs';
import { PadClusteringTrajectorySection } from '../../components/padClustering/PadClusteringTrajectorySection';
import { PadScene3DToolbar } from '../../components/padEarthwork/PadScene3DToolbar';
import { Scene3DLegend } from '../../components/padEarthwork/Scene3DLegend';
import { PageSkeleton } from '../../components/PageSkeleton';
import { usePadClusteringEditorContext } from '../../contexts/PadClusteringEditorContext';
import { useProjectInfraObjects } from '../../hooks/useProjectData';
import { countDesignedTrajectories } from '../../lib/padClusteringWorkflow';
import {
  DEFAULT_PAD_CLUSTERING_SCENE_LAYERS,
  type PadClusteringScene3DLayers,
} from '../../lib/padClusteringScene3dLayers';
import type { Scene3dCameraPreset } from '../../lib/padEarthworkScene3dCamera';
import type { PyWellGeoPlotSegment } from '../../lib/api/pywellgeoApi';
import type { PyWellGeoSelectedNodeMarker } from '../../lib/padClusteringScene3dPyWellGeo';
import './pad-clustering-page.css';

type MobilePane = 'settings' | 'scene';

export function PadClusteringWorkspacePage() {
  const {
    projectId,
    activePadId,
    readOnly,
    pad,
    activeDraft,
    isLoading,
    selectedWellIndex,
    setSelectedWellIndex,
    activeSketch,
    referenceElevationM,
    heightM,
    demPreview,
    demPreviewLoading,
    demAvailable,
    sceneWellsLocal,
    linkedBottomholes,
    sceneTrajectories,
    sceneTrajectoriesHidden,
    sceneLayoutCallout,
    activeEnvelope,
    trajectories,
    trajectoryWarnings,
    trajectorySettings,
    clearancePairs,
    clearanceComputedAt,
    wellsLocalCount,
    activeCalcDraft,
    patchCalcDraft,
    patchDraft,
    kbM,
    activeGeoDraft,
    patchGeoDraft,
    demSource,
    isCalcDirty,
    isGeoDirty,
    generateAndSaveMut,
    generateFromLayoutMut,
    syncBottomholesMut,
    designFromBottomholesMut,
    runClearanceMut,
    saveBottomholeMut,
  } = usePadClusteringEditorContext();

  const { data: infraObjects = [] } = useProjectInfraObjects(projectId, {
    refetchOnMount: 'always',
  });

  const [mobilePane, setMobilePane] = useState<MobilePane>('settings');
  const [sidebarTab, setSidebarTab] = useState<PadClusteringSidebarTab>('pad');
  const scene3dRef = useRef<PadClusteringScene3DHandle>(null);
  const [scene3dZoomPercent, setScene3dZoomPercent] = useState(100);
  const [activeCameraPreset, setActiveCameraPreset] = useState<Scene3dCameraPreset | null>(null);
  const [sceneLayers, setSceneLayers] = useState<PadClusteringScene3DLayers>(
    DEFAULT_PAD_CLUSTERING_SCENE_LAYERS,
  );
  const [pywellgeoSegments, setPywellgeoSegments] = useState<PyWellGeoPlotSegment[]>([]);
  const [pywellgeoSelectedNode, setPywellgeoSelectedNode] = useState<PyWellGeoSelectedNodeMarker | null>(
    null,
  );
  const [pywellgeoLateralTarget, setPywellgeoLateralTarget] = useState<PyWellGeoSelectedNodeMarker | null>(
    null,
  );

  useEffect(() => {
    if (sidebarTab !== 'geo') setPywellgeoSelectedNode(null);
  }, [sidebarTab]);

  const designedCount = countDesignedTrajectories(sceneTrajectories);
  const envelopeEnabled = activeEnvelope.enabled;
  const wrapWidthM = activeEnvelope.wrap_width_m;
  const sfThreshold = trajectorySettings?.sf_warning_threshold ?? 1;
  const clearanceViolationCount = useMemo(
    () => clearancePairs.filter((pair) => pair.warning).length,
    [clearancePairs],
  );
  const trajectoriesOnScene = designedCount > 0 && !sceneTrajectoriesHidden;
  const clearanceComputed = clearancePairs.length > 0;

  if (!activePadId || !activeDraft) {
    if (isLoading) return <PageSkeleton lines={6} />;
    return null;
  }

  return (
    <>
      <div className="pad-clustering-page__mobile-tabs" role="tablist" aria-label="Панель кустования">
        <button
          type="button"
          role="tab"
          aria-selected={mobilePane === 'settings'}
          className={`pad-clustering-page__mobile-tab${mobilePane === 'settings' ? ' pad-clustering-page__mobile-tab--active' : ''}`}
          onClick={() => setMobilePane('settings')}
        >
          <Settings2 size={16} aria-hidden />
          Настройки
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobilePane === 'scene'}
          className={`pad-clustering-page__mobile-tab${mobilePane === 'scene' ? ' pad-clustering-page__mobile-tab--active' : ''}`}
          onClick={() => setMobilePane('scene')}
        >
          <Box size={16} aria-hidden />
          3D
          {designedCount > 0 && (
            <span className="pad-clustering-page__mobile-badge">{designedCount}</span>
          )}
        </button>
      </div>

      <div className={`pad-clustering-page__layout pad-clustering-page__layout--${mobilePane}`}>
        <aside className="pad-clustering-page__sidebar">
          <PadClusteringSidebarTabs
            active={sidebarTab}
            onChange={setSidebarTab}
            calcDirty={isCalcDirty}
            geoDirty={isGeoDirty}
          >
            {sidebarTab === 'pad' ? (
              <PadClusteringSettingsPanel
                readOnly={readOnly}
                draft={activeDraft}
                patchDraft={patchDraft}
                wellsLocalCount={wellsLocalCount}
                kbM={kbM}
                linkedBottomholesCount={linkedBottomholes.length}
                padWellCountDerivedFromBottomholes={linkedBottomholes.length > 0}
                generateAndSaveMut={generateAndSaveMut}
                trajectorySection={
                  <PadClusteringTrajectorySection
                    readOnly={readOnly}
                    trajectories={trajectories}
                    warnings={trajectoryWarnings}
                    linkedBottomholesCount={linkedBottomholes.length}
                    wellsLocalCount={wellsLocalCount}
                    clearancePairs={clearancePairs}
                    clearanceComputedAt={clearanceComputedAt}
                    sfThreshold={sfThreshold}
                    generateFromLayoutMut={generateFromLayoutMut}
                    syncBottomholesMut={syncBottomholesMut}
                    designFromBottomholesMut={designFromBottomholesMut}
                    runClearanceMut={runClearanceMut}
                    selectedWellIndex={selectedWellIndex}
                    onSelectWell={setSelectedWellIndex}
                  />
                }
                bottomholesSection={
                  <PadClusteringBottomholesSection
                    bottomholes={linkedBottomholes}
                    readOnly={readOnly}
                    saveBottomholeMut={saveBottomholeMut}
                  />
                }
              />
            ) : sidebarTab === 'calc' ? (
              <PadClusteringCalculationPanel
                readOnly={readOnly}
                draft={activeCalcDraft}
                patchDraft={patchCalcDraft}
                demAvailable={demAvailable}
                demSource={demSource}
              />
            ) : projectId && activePadId ? (
              <PadClusteringPyWellGeoPanel
                readOnly={readOnly}
                projectId={projectId}
                padId={activePadId}
                draft={activeGeoDraft}
                patchDraft={patchGeoDraft}
                trajectories={trajectories}
                selectedWellIndex={selectedWellIndex ?? 0}
                onSelectWell={(idx) => setSelectedWellIndex(idx)}
                infraObjects={infraObjects}
                bottomholes={linkedBottomholes}
                padLon={pad?.lon ?? 0}
                padLat={pad?.lat ?? 0}
                onPlotSegmentsChange={setPywellgeoSegments}
                onSelectedTreeNodeChange={setPywellgeoSelectedNode}
                onLateralTargetChange={setPywellgeoLateralTarget}
              />
            ) : null}
          </PadClusteringSidebarTabs>
        </aside>

        <div className="pad-clustering-page__viewer">
          <div className="pad-clustering-page__viewer-head">
            <div
              className="pad-clustering-page__viewer-tools"
              title="Колёсико — зум · ЛКМ — вращение · ПКМ — сдвиг"
            >
              <PadClusteringScene3DLayerToggles
                layers={sceneLayers}
                onChange={setSceneLayers}
                envelopeAvailable={envelopeEnabled && wrapWidthM > 0}
                trajectoriesAvailable={trajectoriesOnScene}
                clearanceAvailable={trajectoriesOnScene && clearanceComputed && clearanceViolationCount > 0}
                pywellgeoAvailable={pywellgeoSegments.length > 0}
                bottomholesAvailable={linkedBottomholes.length > 0 || designedCount > 0}
              />
              <PadScene3DToolbar
                showHint={false}
                zoomPercent={scene3dZoomPercent}
                activePreset={activeCameraPreset}
                onZoomIn={() => scene3dRef.current?.zoomIn()}
                onZoomOut={() => scene3dRef.current?.zoomOut()}
                onFitView={() => scene3dRef.current?.fitView()}
                onCameraPreset={(preset) => scene3dRef.current?.setCameraPreset(preset)}
                onOrbitLeft={() => scene3dRef.current?.orbitLeft()}
                onOrbitRight={() => scene3dRef.current?.orbitRight()}
                onTiltUp={() => scene3dRef.current?.tiltUp()}
                onTiltDown={() => scene3dRef.current?.tiltDown()}
              />
            </div>
          </div>
          <div className="pad-clustering-page__scene-wrap">
            <PadClusteringScene3D
              ref={scene3dRef}
              sketch={activeSketch}
              referenceElevationM={referenceElevationM}
              heightM={heightM}
              demPreview={demPreview}
              envelopeEnabled={envelopeEnabled}
              wrapWidthM={wrapWidthM}
              demAvailable={demAvailable}
              demLoading={demPreviewLoading}
              wellsLocal={sceneWellsLocal}
              bottomholes={linkedBottomholes}
              padLon={pad?.lon ?? 0}
              padLat={pad?.lat ?? 0}
              trajectories={sceneTrajectories}
              clearancePairs={clearancePairs}
              pywellgeoSegments={pywellgeoSegments}
              pywellgeoSelectedNode={sidebarTab === 'geo' ? pywellgeoSelectedNode : null}
              pywellgeoLateralTarget={sidebarTab === 'geo' ? pywellgeoLateralTarget : null}
              trajectoriesHiddenReason={sceneLayoutCallout}
              sceneResetKey={activePadId}
              sfWarningThreshold={sfThreshold}
              sceneLayers={sceneLayers}
              selectedWellIndex={selectedWellIndex}
              onWellSelect={setSelectedWellIndex}
              onCameraStateChange={({ zoomPercent, activePreset }) => {
                setScene3dZoomPercent(zoomPercent);
                setActiveCameraPreset(activePreset);
              }}
            />
            <Scene3DLegend
              variant="overlay"
              demActive={Boolean(demPreview)}
              envelopeActive={envelopeEnabled && wrapWidthM > 0}
              showWellheads={sceneWellsLocal.length > 0}
              showBottomholes={
                linkedBottomholes.length > 0 ||
                (designedCount > 0 && !sceneTrajectoriesHidden)
              }
              showTrajectories={trajectoriesOnScene}
              showClearanceSf={trajectoriesOnScene && clearanceComputed}
              sfWarningThreshold={sfThreshold}
              clearanceViolationCount={clearanceViolationCount}
            />
          </div>
        </div>
      </div>
    </>
  );
}
