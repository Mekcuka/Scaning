import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ProjectLink } from '../../components/ProjectLink';
import { Layers, MapPin, Save, Settings2, Box } from 'lucide-react';
import { AppSelect } from '../../components/AppSelect';
import { usePageHeader } from '../../components/layout/pageHeaderContext';
import { PadClusteringBottomholesSection } from '../../components/padClustering/PadClusteringBottomholesSection';
import { PadClusteringCalculationPanel } from '../../components/padClustering/PadClusteringCalculationPanel';
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
import { useActiveProject } from '../../hooks/useActiveProject';
import { filterPadObjects, usePadClusteringEditor } from '../../hooks/usePadClusteringEditor';
import { usePermissions } from '../../hooks/usePermissions';
import { useProjectInfraObjects } from '../../hooks/useProjectData';
import { countDesignedTrajectories } from '../../lib/padClusteringWorkflow';
import {
  DEFAULT_PAD_CLUSTERING_SCENE_LAYERS,
  type PadClusteringScene3DLayers,
} from '../../lib/padClusteringScene3dLayers';
import type { Scene3dCameraPreset } from '../../lib/padEarthworkScene3dCamera';
import { SUBTYPE_LABELS } from '../../lib/api';
import './pad-clustering-page.css';

type MobilePane = 'settings' | 'scene';

export function PadClusteringPage() {
  const { projectId, activeProject } = useActiveProject();
  const { can } = usePermissions();
  const readOnly = !can('write_infra');
  const [searchParams, setSearchParams] = useSearchParams();
  const padIdFromUrl = searchParams.get('padId') ?? '';

  const { data: infraObjects = [], isLoading: infraLoading } = useProjectInfraObjects(projectId);
  const pads = useMemo(() => filterPadObjects(infraObjects), [infraObjects]);

  const [selectedPadId, setSelectedPadId] = useState('');
  const [mobilePane, setMobilePane] = useState<MobilePane>('settings');
  const [sidebarTab, setSidebarTab] = useState<PadClusteringSidebarTab>('pad');

  useEffect(() => {
    if (padIdFromUrl && pads.some((p) => p.id === padIdFromUrl)) {
      setSelectedPadId(padIdFromUrl);
      return;
    }
    if (!selectedPadId && pads.length > 0) {
      setSelectedPadId(pads[0]!.id);
    }
  }, [padIdFromUrl, pads, selectedPadId]);

  const activePadId = selectedPadId || pads[0]?.id || '';
  const editor = usePadClusteringEditor(projectId, activePadId || null, infraObjects);

  const scene3dRef = useRef<PadClusteringScene3DHandle>(null);
  const [scene3dZoomPercent, setScene3dZoomPercent] = useState(100);
  const [activeCameraPreset, setActiveCameraPreset] = useState<Scene3dCameraPreset | null>(null);
  const [sceneLayers, setSceneLayers] = useState<PadClusteringScene3DLayers>(
    DEFAULT_PAD_CLUSTERING_SCENE_LAYERS,
  );
  const [selectedWellIndex, setSelectedWellIndex] = useState<number | null>(null);

  useEffect(() => {
    setSelectedWellIndex(null);
  }, [activePadId]);

  const handleWellSelect = (wellIndex: number | null) => {
    setSelectedWellIndex(wellIndex);
  };

  const handlePadChange = (padId: string) => {
    setSelectedPadId(padId);
    if (padId) {
      setSearchParams({ padId }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  };

  const designedCount = countDesignedTrajectories(editor.sceneTrajectories);
  const envelopeEnabled = editor.activeEnvelope.enabled;
  const wrapWidthM = editor.activeEnvelope.wrap_width_m;

  const padSubtitle = useMemo(() => {
    if (!projectId) return 'Выберите активный проект на дашборде или в списке проектов.';
    const parts = [activeProject?.name ?? 'Проект'];
    if (editor.pad) {
      parts.push(editor.pad.name);
      parts.push(SUBTYPE_LABELS[editor.pad.subtype] ?? editor.pad.subtype);
    }
    return parts.join(' · ');
  }, [activeProject?.name, editor.pad, projectId]);

  usePageHeader({ title: 'Кустование', subtitle: padSubtitle }, [padSubtitle]);

  if (!projectId) {
    return (
      <div className="pad-clustering-page">
        <div className="pad-clustering-page__empty-state">
          <Layers size={40} strokeWidth={1.25} aria-hidden />
        </div>
      </div>
    );
  }

  return (
    <div className="pad-clustering-page">
      <div className="pad-clustering-page__chrome">
        <header className="pad-clustering-page__header">
          <div className="pad-clustering-page__toolbar">
            <div className="pad-clustering-page__pad-select">
              <span className="pad-clustering-page__select-label">Куст</span>
              <AppSelect
                options={pads.map((p) => ({ value: p.id, label: p.name }))}
                value={activePadId}
                onChange={handlePadChange}
                disabled={infraLoading || pads.length === 0}
                placeholder={infraLoading ? 'Загрузка…' : 'Нет кустов'}
                ariaLabel="Кустовая площадка"
                variant="sm"
              />
            </div>
            {editor.pad && (
              <Link
                to={`/map?select=${editor.pad.id}`}
                className="btn btn--ghost btn--sm pad-clustering-page__map-link"
                title="Открыть куст на карте"
              >
                <MapPin size={16} aria-hidden />
                <span className="pad-clustering-page__map-link-label">Карта</span>
              </Link>
            )}
            <button
              type="button"
              className={`btn btn--primary btn--sm${editor.isAnyDirty ? ' pad-clustering-page__save--dirty' : ''}`}
              disabled={readOnly || !activePadId || editor.savePadMut.isPending}
              onClick={() => editor.savePadMut.mutate()}
              title={editor.isAnyDirty ? 'Есть несохранённые изменения' : 'Сохранить параметры куста'}
            >
              <Save size={16} aria-hidden />
              {editor.savePadMut.isPending
                ? 'Сохранение…'
                : editor.isAnyDirty
                  ? 'Сохранить *'
                  : 'Сохранить'}
            </button>
          </div>
        </header>
      </div>

      {pads.length === 0 && !infraLoading && (
        <div className="pad-clustering-page__empty-state">
          <Layers size={36} strokeWidth={1.25} aria-hidden />
          <p>
            В проекте нет кустовых площадок.{' '}
            <ProjectLink to="/map" className="link">
              Добавьте oil_pad / gas_pad на карте
            </ProjectLink>
            .
          </p>
        </div>
      )}

      {infraLoading && pads.length === 0 && <PageSkeleton lines={4} />}

      {activePadId && editor.isLoading && !editor.activeDraft && (
        <PageSkeleton lines={6} />
      )}

      {activePadId && editor.activeDraft && (
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

          <div
            className={`pad-clustering-page__layout pad-clustering-page__layout--${mobilePane}`}
          >
            <aside className="pad-clustering-page__sidebar">
              <PadClusteringSidebarTabs
                active={sidebarTab}
                onChange={setSidebarTab}
                calcDirty={editor.isCalcDirty}
              >
                {sidebarTab === 'pad' ? (
                  <PadClusteringSettingsPanel
                    readOnly={readOnly}
                    draft={editor.activeDraft}
                    patchDraft={editor.patchDraft}
                    wellsLocalCount={editor.wellsLocalCount}
                    kbM={editor.kbM}
                    generateAndSaveMut={editor.generateAndSaveMut}
                    trajectorySection={
                      <PadClusteringTrajectorySection
                        readOnly={readOnly}
                        trajectories={editor.trajectories}
                        warnings={editor.trajectoryWarnings}
                        linkedBottomholesCount={editor.linkedBottomholes.length}
                        wellsLocalCount={editor.wellsLocalCount}
                        clearancePairs={editor.clearancePairs}
                        clearanceComputedAt={editor.clearanceComputedAt}
                        sfThreshold={editor.trajectorySettings?.sf_warning_threshold ?? 1}
                        generateFromLayoutMut={editor.generateFromLayoutMut}
                        syncBottomholesMut={editor.syncBottomholesMut}
                        designFromBottomholesMut={editor.designFromBottomholesMut}
                        runClearanceMut={editor.runClearanceMut}
                        selectedWellIndex={selectedWellIndex}
                        onSelectWell={handleWellSelect}
                      />
                    }
                    bottomholesSection={
                      <PadClusteringBottomholesSection
                        bottomholes={editor.linkedBottomholes}
                        readOnly={readOnly}
                        saveBottomholeMut={editor.saveBottomholeMut}
                      />
                    }
                  />
                ) : (
                  <PadClusteringCalculationPanel
                    readOnly={readOnly}
                    draft={editor.activeCalcDraft}
                    patchDraft={editor.patchCalcDraft}
                    demAvailable={editor.demAvailable}
                    demSource={editor.demSource}
                  />
                )}
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
                    trajectoriesAvailable={designedCount > 0 && !editor.sceneTrajectoriesHidden}
                    bottomholesAvailable={editor.linkedBottomholes.length > 0 || designedCount > 0}
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
                  sketch={editor.activeSketch}
                  referenceElevationM={editor.referenceElevationM}
                  heightM={editor.heightM}
                  demPreview={editor.demPreview}
                  envelopeEnabled={envelopeEnabled}
                  wrapWidthM={wrapWidthM}
                  demAvailable={editor.demAvailable}
                  demLoading={editor.demPreviewLoading}
                  wellsLocal={editor.sceneWellsLocal}
                  bottomholes={editor.linkedBottomholes}
                  padLon={editor.pad?.lon ?? 0}
                  padLat={editor.pad?.lat ?? 0}
                  trajectories={editor.sceneTrajectories}
                  trajectoriesHiddenReason={editor.sceneLayoutCallout}
                  sfWarningThreshold={editor.trajectorySettings?.sf_warning_threshold ?? 1}
                  sceneLayers={sceneLayers}
                  selectedWellIndex={selectedWellIndex}
                  onWellSelect={handleWellSelect}
                  onCameraStateChange={({ zoomPercent, activePreset }) => {
                    setScene3dZoomPercent(zoomPercent);
                    setActiveCameraPreset(activePreset);
                  }}
                />
                <Scene3DLegend
                  variant="overlay"
                  demActive={Boolean(editor.demPreview)}
                  envelopeActive={envelopeEnabled && wrapWidthM > 0}
                  showWellheads={editor.sceneWellsLocal.length > 0}
                  showBottomholes={
                    editor.linkedBottomholes.length > 0 ||
                    (designedCount > 0 && !editor.sceneTrajectoriesHidden)
                  }
                  showTrajectories={designedCount > 0 && !editor.sceneTrajectoriesHidden}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
