import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, forwardRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { InfraObject } from '../../lib/api';
import type { WellTrajectory } from '../../lib/api/wellTrajectoryApi';
import type { PadDemPreview } from '../../lib/padEarthworkDemPreview';
import {
  bottomholesSceneRevision,
  buildBottomholeLayer,
  buildTrajectoryLines,
  buildWellheadMarkers,
  isPointerClick,
  kbFromPad,
  pickWellheadIndex,
} from '../../lib/padClusteringScene3d';
import {
  applyPadClusteringLayerVisibility,
  type PadClusteringScene3DLayers,
} from '../../lib/padClusteringScene3dLayers';
import { trajectoriesSceneRevision } from '../../lib/padClusteringSceneTrajectories';
import { PadClusteringPlanOverlay } from './PadClusteringPlanOverlay';
import { PadClusteringScene3DCompass } from './PadClusteringScene3DCompass';
import { PadClusteringWellLabelsOverlay } from './PadClusteringWellLabelsOverlay';
import {
  buildEnvelopeBermRing,
  buildFlatGroundPlane,
  buildPadMesh,
  buildTerrainMesh,
  disposeObject3D,
  footprintSceneBounds,
  frameSceneInView,
  padFootprintVertices,
} from '../../lib/padEarthworkScene3d';
import {
  orbitScene3dCamera,
  shouldSyncPlanCamera,
  syncTopDownPlanCamera,
  scene3dCameraZoomPercent,
  scene3dToolbarZoomIn,
  scene3dToolbarZoomOut,
  SCENE3D_ORBIT_STEP_RAD,
  SCENE3D_TILT_STEP_RAD,
  setScene3dCameraPreset,
  type Scene3dCameraPreset,
} from '../../lib/padEarthworkScene3dCamera';
import type { PlanShapeSketch, PlanVertex } from '../../lib/padEarthworkSketch';

export type PadClusteringScene3DCameraState = {
  zoomPercent: number;
  activePreset: Scene3dCameraPreset | null;
};

export type PadClusteringScene3DProps = {
  sketch: PlanShapeSketch;
  referenceElevationM: number;
  heightM: number;
  demPreview: PadDemPreview | null;
  envelopeEnabled: boolean;
  wrapWidthM: number;
  demAvailable: boolean;
  demLoading?: boolean;
  wellsLocal: PlanVertex[];
  bottomholes: InfraObject[];
  padLon: number;
  padLat: number;
  trajectories: WellTrajectory[];
  sceneLayers: PadClusteringScene3DLayers;
  selectedWellIndex?: number | null;
  sfWarningThreshold?: number;
  trajectoriesHiddenReason?: string | null;
  onWellSelect?: (wellIndex: number | null) => void;
  onCameraStateChange?: (state: PadClusteringScene3DCameraState) => void;
};

export type PadClusteringScene3DHandle = {
  fitView: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  setCameraPreset: (preset: Scene3dCameraPreset) => void;
  orbitLeft: () => void;
  orbitRight: () => void;
  tiltUp: () => void;
  tiltDown: () => void;
  selectWell: (wellIndex: number | null) => void;
};

function wrapSceneLayer(name: string, object: THREE.Object3D): THREE.Group {
  const layer = new THREE.Group();
  layer.name = name;
  layer.add(object);
  return layer;
}

export const PadClusteringScene3D = forwardRef<PadClusteringScene3DHandle, PadClusteringScene3DProps>(
  function PadClusteringScene3D(
    {
      sketch,
      referenceElevationM,
      heightM,
      demPreview,
      envelopeEnabled,
      wrapWidthM,
      demAvailable,
      demLoading = false,
      wellsLocal,
      bottomholes,
      padLon,
      padLat,
      trajectories,
      sceneLayers,
      selectedWellIndex = null,
      sfWarningThreshold = 1,
      trajectoriesHiddenReason = null,
      onWellSelect,
      onCameraStateChange,
    },
    ref,
  ) {
    const wrapRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const sceneRootRef = useRef<THREE.Group | null>(null);
    const pendingAutoFrameRef = useRef(true);
    const userOrbitRef = useRef(false);
    const baselineDistanceRef = useRef<number | null>(null);
    const cameraPresetRef = useRef<Scene3dCameraPreset | null>(null);
    const pointerDownRef = useRef<{ x: number; y: number } | null>(null);
    const onCameraStateChangeRef = useRef(onCameraStateChange);
    const onWellSelectRef = useRef(onWellSelect);
    const selectedWellIndexRef = useRef(selectedWellIndex);
    const sceneLayersRef = useRef(sceneLayers);
    const sceneRef = useRef<{
      scene: THREE.Scene;
      camera: THREE.PerspectiveCamera;
      renderer: THREE.WebGLRenderer;
      controls: OrbitControls;
      content: THREE.Group;
      fitView: () => number | null;
    } | null>(null);

    onCameraStateChangeRef.current = onCameraStateChange;
    onWellSelectRef.current = onWellSelect;
    selectedWellIndexRef.current = selectedWellIndex;
    sceneLayersRef.current = sceneLayers;

    const kbM = kbFromPad(referenceElevationM, heightM);
    const trajectoriesRevision = useMemo(
      () => trajectoriesSceneRevision(trajectories),
      [trajectories],
    );
    const bottomholesRevision = useMemo(
      () => bottomholesSceneRevision(bottomholes),
      [bottomholes],
    );

    const emitCameraState = useCallback(() => {
      const ctx = sceneRef.current;
      if (!ctx || !onCameraStateChangeRef.current) return;
      onCameraStateChangeRef.current({
        zoomPercent: scene3dCameraZoomPercent(
          ctx.camera,
          ctx.controls,
          baselineDistanceRef.current,
        ),
        activePreset: cameraPresetRef.current,
      });
    }, []);

    const withRoot = useCallback(
      (fn: (ctx: NonNullable<typeof sceneRef.current>, root: THREE.Group) => void) => {
        const ctx = sceneRef.current;
        const root = sceneRootRef.current;
        if (ctx && root) fn(ctx, root);
      },
      [],
    );

    const tryAutoFrame = useCallback(() => {
      if (!pendingAutoFrameRef.current || userOrbitRef.current) return;
      const ctx = sceneRef.current;
      if (!ctx) return;
      const distance = ctx.fitView();
      if (distance != null) baselineDistanceRef.current = distance;
      emitCameraState();
    }, [emitCameraState]);

    const fitView = useCallback(() => {
      cameraPresetRef.current = null;
      withRoot((ctx) => {
        const distance = ctx.fitView();
        if (distance != null) baselineDistanceRef.current = distance;
        pendingAutoFrameRef.current = false;
        emitCameraState();
      });
    }, [withRoot, emitCameraState]);

    const zoomIn = useCallback(() => {
      withRoot((ctx) => scene3dToolbarZoomIn(ctx.camera, ctx.controls));
      emitCameraState();
    }, [withRoot, emitCameraState]);

    const zoomOut = useCallback(() => {
      withRoot((ctx) => scene3dToolbarZoomOut(ctx.camera, ctx.controls));
      emitCameraState();
    }, [withRoot, emitCameraState]);

    const setCameraPreset = useCallback(
      (preset: Scene3dCameraPreset) => {
        cameraPresetRef.current = preset;
        withRoot((ctx, root) => {
          const distance = setScene3dCameraPreset(ctx.camera, ctx.controls, root, preset);
          if (distance != null) baselineDistanceRef.current = distance;
          emitCameraState();
        });
      },
      [withRoot, emitCameraState],
    );

    const orbitLeft = useCallback(() => {
      cameraPresetRef.current = null;
      withRoot((ctx) => orbitScene3dCamera(ctx.camera, ctx.controls, SCENE3D_ORBIT_STEP_RAD));
      emitCameraState();
    }, [withRoot, emitCameraState]);

    const orbitRight = useCallback(() => {
      cameraPresetRef.current = null;
      withRoot((ctx) => orbitScene3dCamera(ctx.camera, ctx.controls, -SCENE3D_ORBIT_STEP_RAD));
      emitCameraState();
    }, [withRoot, emitCameraState]);

    const tiltUp = useCallback(() => {
      cameraPresetRef.current = null;
      withRoot((ctx) => orbitScene3dCamera(ctx.camera, ctx.controls, 0, -SCENE3D_TILT_STEP_RAD));
      emitCameraState();
    }, [withRoot, emitCameraState]);

    const tiltDown = useCallback(() => {
      cameraPresetRef.current = null;
      withRoot((ctx) => orbitScene3dCamera(ctx.camera, ctx.controls, 0, SCENE3D_TILT_STEP_RAD));
      emitCameraState();
    }, [withRoot, emitCameraState]);

    const selectWell = useCallback((wellIndex: number | null) => {
      onWellSelectRef.current?.(wellIndex);
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        fitView,
        zoomIn,
        zoomOut,
        setCameraPreset,
        orbitLeft,
        orbitRight,
        tiltUp,
        tiltDown,
        selectWell,
      }),
      [fitView, zoomIn, zoomOut, setCameraPreset, orbitLeft, orbitRight, tiltUp, tiltDown, selectWell],
    );

    const getSceneView = useCallback(() => {
      const ctx = sceneRef.current;
      const canvas = canvasRef.current;
      if (!ctx || !canvas) return null;
      return {
        camera: ctx.camera,
        width: canvas.clientWidth,
        height: canvas.clientHeight,
      };
    }, []);

    const getCompassView = useCallback(() => {
      const ctx = sceneRef.current;
      if (!ctx) return null;
      return {
        camera: ctx.camera,
        target: ctx.controls.target,
        planViewLocked: shouldSyncPlanCamera(
          ctx.camera,
          ctx.controls.target,
          cameraPresetRef.current,
        ),
      };
    }, []);

    useEffect(() => {
      const canvas = canvasRef.current;
      const wrap = wrapRef.current;
      if (!canvas || !wrap) return undefined;

      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xf4f6f8);

      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 8000);
      camera.position.set(80, 60, 80);

      scene.add(new THREE.AmbientLight(0xffffff, 0.58));
      const sun = new THREE.DirectionalLight(0xfff8ee, 1.05);
      sun.position.set(40, 80, 30);
      scene.add(sun);

      const content = new THREE.Group();
      scene.add(content);

      const controls = new OrbitControls(camera, canvas);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.addEventListener('change', emitCameraState);
      controls.addEventListener('start', () => {
        userOrbitRef.current = true;
        pendingAutoFrameRef.current = false;
        cameraPresetRef.current = null;
        emitCameraState();
      });

      const doFitView = () => {
        const root = sceneRootRef.current;
        if (!root) return null;
        const distance = frameSceneInView(camera, controls, root);
        if (distance != null) baselineDistanceRef.current = distance;
        pendingAutoFrameRef.current = false;
        emitCameraState();
        return distance;
      };

      sceneRef.current = { scene, camera, renderer, controls, content, fitView: doFitView };

      const resize = () => {
        const w = Math.max(wrap.clientWidth, 1);
        const h = Math.max(wrap.clientHeight, 1);
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        if (pendingAutoFrameRef.current && !userOrbitRef.current) {
          tryAutoFrame();
        }
      };

      const ro = new ResizeObserver(resize);
      ro.observe(wrap);
      resize();

      let raf = 0;
      const tick = () => {
        raf = requestAnimationFrame(tick);
        controls.update();
        if (shouldSyncPlanCamera(camera, controls.target, cameraPresetRef.current)) {
          syncTopDownPlanCamera(camera, controls.target);
        }
        renderer.render(scene, camera);
      };
      tick();

      return () => {
        cancelAnimationFrame(raf);
        controls.removeEventListener('change', emitCameraState);
        ro.disconnect();
        controls.dispose();
        renderer.dispose();
        if (sceneRootRef.current) {
          disposeObject3D(sceneRootRef.current);
          sceneRootRef.current = null;
        }
        sceneRef.current = null;
      };
    }, [emitCameraState, tryAutoFrame]);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return undefined;

      const onPointerDown = (event: PointerEvent) => {
        pointerDownRef.current = { x: event.clientX, y: event.clientY };
      };

      const onPointerUp = (event: PointerEvent) => {
        const down = pointerDownRef.current;
        pointerDownRef.current = null;
        if (!down || !onWellSelectRef.current) return;
        if (!isPointerClick(down, { x: event.clientX, y: event.clientY })) return;
        if (!sceneLayersRef.current.wellheads) return;

        const ctx = sceneRef.current;
        const root = sceneRootRef.current;
        if (!ctx || !root) return;

        const layer = root.getObjectByName('layer-wellheads');
        const picked = pickWellheadIndex(event, canvas, ctx.camera, layer);
        if (picked == null) {
          onWellSelectRef.current(null);
          return;
        }
        onWellSelectRef.current(
          selectedWellIndexRef.current === picked ? null : picked,
        );
      };

      canvas.addEventListener('pointerdown', onPointerDown);
      canvas.addEventListener('pointerup', onPointerUp);
      return () => {
        canvas.removeEventListener('pointerdown', onPointerDown);
        canvas.removeEventListener('pointerup', onPointerUp);
      };
    }, []);

    useEffect(() => {
      const ctx = sceneRef.current;
      if (!ctx) return undefined;

      if (sceneRootRef.current) {
        ctx.content.remove(sceneRootRef.current);
        disposeObject3D(sceneRootRef.current);
        sceneRootRef.current = null;
      }

      const root = new THREE.Group();
      const refM = referenceElevationM;
      const bounds =
        demPreview?.bounds ?? footprintSceneBounds(padFootprintVertices(sketch));

      const groundMesh = demPreview
        ? buildTerrainMesh(demPreview)
        : buildFlatGroundPlane(bounds, refM);
      root.add(wrapSceneLayer('layer-ground', groundMesh));

      root.add(wrapSceneLayer('layer-pad', buildPadMesh(sketch, refM, heightM)));

      const bermActive = envelopeEnabled && wrapWidthM > 0;
      const bermGroup = new THREE.Group();
      bermGroup.name = 'layer-envelope';
      if (bermActive) {
        const berm = buildEnvelopeBermRing(sketch, wrapWidthM, refM, heightM);
        if (berm) bermGroup.add(berm);
      }
      root.add(bermGroup);

      if (wellsLocal.length > 0) {
        root.add(
          buildWellheadMarkers(wellsLocal, kbM, { selectedWellIndex }),
        );
      } else {
        const emptyWellheads = new THREE.Group();
        emptyWellheads.name = 'layer-wellheads';
        root.add(emptyWellheads);
      }

      const trajGroup = new THREE.Group();
      trajGroup.name = 'layer-trajectories';
      if (trajectories.length > 0) {
        trajGroup.add(buildTrajectoryLines(trajectories, kbM, sfWarningThreshold));
      }
      root.add(trajGroup);
      root.add(buildBottomholeLayer(bottomholes, trajectories, padLon, padLat, kbM));

      applyPadClusteringLayerVisibility(root, sceneLayersRef.current);

      sceneRootRef.current = root;
      ctx.content.add(root);

      userOrbitRef.current = false;
      pendingAutoFrameRef.current = true;
      tryAutoFrame();
      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        tryAutoFrame();
        raf2 = requestAnimationFrame(() => tryAutoFrame());
      });

      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
      };
    }, [
      sketch,
      referenceElevationM,
      heightM,
      demPreview,
      envelopeEnabled,
      wrapWidthM,
      wellsLocal,
      bottomholes,
      bottomholesRevision,
      padLon,
      padLat,
      trajectories,
      trajectoriesRevision,
      sfWarningThreshold,
      selectedWellIndex,
      kbM,
      tryAutoFrame,
    ]);

    useEffect(() => {
      const root = sceneRootRef.current;
      if (!root) return;
      applyPadClusteringLayerVisibility(root, sceneLayers);
    }, [sceneLayers]);

    const showDemHint = !demAvailable || (!demPreview && !demLoading);

    return (
      <div className="pad-earthwork-scene3d pad-clustering-scene3d">
        {showDemHint && (
          <div className="pad-earthwork-scene3d__callout" role="status">
            {demAvailable
              ? 'Рельеф загружается… Упрощённая плоскость на опорной отметке.'
              : 'DEM не загружен — плоскость на опорной отметке. Загрузите DEM в карточке куста на карте.'}
          </div>
        )}
        {trajectoriesHiddenReason && (
          <div className="pad-earthwork-scene3d__callout pad-earthwork-scene3d__callout--info" role="status">
            {trajectoriesHiddenReason}
          </div>
        )}
        <div ref={wrapRef} className="pad-earthwork-scene3d__canvas-wrap">
          <PadClusteringPlanOverlay sketch={sketch} wellsLocal={wellsLocal} />
          <PadClusteringWellLabelsOverlay
            wellsLocal={wellsLocal}
            trajectories={trajectories}
            kbM={kbM}
            selectedWellIndex={selectedWellIndex}
            visible={sceneLayers.wellLabels}
            getSceneView={getSceneView}
          />
          <PadClusteringScene3DCompass getCompassView={getCompassView} />
          <canvas
            ref={canvasRef}
            className="pad-earthwork-scene3d__canvas"
            aria-label="3D-сцена кустования"
          />
        </div>
      </div>
    );
  },
);
