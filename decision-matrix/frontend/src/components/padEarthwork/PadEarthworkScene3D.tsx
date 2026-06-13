import { useCallback, useEffect, useImperativeHandle, useRef, forwardRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { PadDemPreview } from '../../lib/padEarthworkDemPreview';
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
import type { PlanShapeSketch } from '../../lib/padEarthworkSketch';

export type PadEarthworkScene3DProps = {
  sketch: PlanShapeSketch;
  referenceElevationM: number;
  heightM: number;
  demPreview: PadDemPreview | null;
  envelopeEnabled: boolean;
  wrapWidthM: number;
  demAvailable: boolean;
  demLoading?: boolean;
  onCameraStateChange?: (state: { zoomPercent: number }) => void;
};

export type PadEarthworkScene3DHandle = {
  fitView: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  setCameraPreset: (preset: Scene3dCameraPreset) => void;
  orbitLeft: () => void;
  orbitRight: () => void;
  tiltUp: () => void;
  tiltDown: () => void;
};

export const PadEarthworkScene3D = forwardRef<PadEarthworkScene3DHandle, PadEarthworkScene3DProps>(
  function PadEarthworkScene3D(
    {
      sketch,
      referenceElevationM,
      heightM,
      demPreview,
      envelopeEnabled,
      wrapWidthM,
      demAvailable,
      demLoading = false,
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
    const onCameraStateChangeRef = useRef(onCameraStateChange);
    const sceneRef = useRef<{
      scene: THREE.Scene;
      camera: THREE.PerspectiveCamera;
      renderer: THREE.WebGLRenderer;
      controls: OrbitControls;
      content: THREE.Group;
      fitView: () => number | null;
    } | null>(null);

    useEffect(() => {
      onCameraStateChangeRef.current = onCameraStateChange;
    }, [onCameraStateChange]);

    const emitCameraState = useCallback(() => {
      const ctx = sceneRef.current;
      if (!ctx) return;
      onCameraStateChangeRef.current?.({
        zoomPercent: scene3dCameraZoomPercent(
          ctx.camera,
          ctx.controls,
          baselineDistanceRef.current,
        ),
      });
    }, []);

    const withRoot = useCallback(
      (fn: (ctx: NonNullable<typeof sceneRef.current>, root: THREE.Group) => void) => {
        const ctx = sceneRef.current;
        const root = sceneRootRef.current;
        if (!ctx || !root) return;
        fn(ctx, root);
        emitCameraState();
      },
      [emitCameraState],
    );

    const tryAutoFrame = useCallback(() => {
      const ctx = sceneRef.current;
      const root = sceneRootRef.current;
      const wrap = wrapRef.current;
      if (!ctx || !root || !wrap) return false;
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      if (w < 64 || h < 64) return false;
      const distance = frameSceneInView(ctx.camera, ctx.controls, root);
      if (distance == null) return false;
      baselineDistanceRef.current = distance;
      pendingAutoFrameRef.current = false;
      emitCameraState();
      return true;
    }, [emitCameraState]);

    const fitView = useCallback(() => {
      cameraPresetRef.current = null;
      withRoot((ctx, root) => {
        const distance = frameSceneInView(ctx.camera, ctx.controls, root);
        if (distance != null) baselineDistanceRef.current = distance;
        pendingAutoFrameRef.current = false;
      });
    }, [withRoot]);

    const zoomIn = useCallback(() => {
      withRoot((ctx) => scene3dToolbarZoomIn(ctx.camera, ctx.controls));
    }, [withRoot]);

    const zoomOut = useCallback(() => {
      withRoot((ctx) => scene3dToolbarZoomOut(ctx.camera, ctx.controls));
    }, [withRoot]);

    const setCameraPreset = useCallback(
      (preset: Scene3dCameraPreset) => {
        cameraPresetRef.current = preset;
        withRoot((ctx, root) => {
          const distance = setScene3dCameraPreset(ctx.camera, ctx.controls, root, preset);
          if (distance != null) baselineDistanceRef.current = distance;
        });
      },
      [withRoot],
    );

    const orbitLeft = useCallback(() => {
      withRoot((ctx) => orbitScene3dCamera(ctx.camera, ctx.controls, SCENE3D_ORBIT_STEP_RAD));
    }, [withRoot]);

    const orbitRight = useCallback(() => {
      withRoot((ctx) => orbitScene3dCamera(ctx.camera, ctx.controls, -SCENE3D_ORBIT_STEP_RAD));
    }, [withRoot]);

    const tiltUp = useCallback(() => {
      withRoot((ctx) => orbitScene3dCamera(ctx.camera, ctx.controls, 0, -SCENE3D_TILT_STEP_RAD));
    }, [withRoot]);

    const tiltDown = useCallback(() => {
      withRoot((ctx) => orbitScene3dCamera(ctx.camera, ctx.controls, 0, SCENE3D_TILT_STEP_RAD));
    }, [withRoot]);

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
      }),
      [fitView, zoomIn, zoomOut, setCameraPreset, orbitLeft, orbitRight, tiltUp, tiltDown],
    );

    useEffect(() => {
      const canvas = canvasRef.current;
      const wrap = wrapRef.current;
      if (!canvas || !wrap) return undefined;

      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xf4f6f8);

      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 800);
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

      if (demPreview) {
        root.add(buildTerrainMesh(demPreview));
      } else {
        root.add(buildFlatGroundPlane(bounds, refM));
      }

      const bermActive = envelopeEnabled && wrapWidthM > 0;
      root.add(
        buildPadMesh(sketch, refM, heightM, bermActive ? { bermWrapWidthM: wrapWidthM } : {}),
      );

      if (bermActive) {
        const berm = buildEnvelopeBermRing(sketch, wrapWidthM, refM, heightM);
        if (berm) root.add(berm);
      }

      sceneRootRef.current = root;
      ctx.content.add(root);

      if (demPreview) {
        userOrbitRef.current = false;
      }
      pendingAutoFrameRef.current = !userOrbitRef.current;
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
      tryAutoFrame,
    ]);

    const showDemHint = !demAvailable || (!demPreview && !demLoading);

    return (
      <div className="pad-earthwork-scene3d">
        {showDemHint && (
          <div className="pad-earthwork-scene3d__callout" role="status">
            {demAvailable
              ? 'Рельеф загружается… Упрощённая плоскость на опорной отметке.'
              : 'Загрузите DEM на вкладке «План» для отображения рельефа. Сейчас — плоскость на опорной отметке.'}
          </div>
        )}
        <div ref={wrapRef} className="pad-earthwork-scene3d__canvas-wrap">
          <canvas
            ref={canvasRef}
            className="pad-earthwork-scene3d__canvas"
            aria-label="3D-сцена площадки"
          />
        </div>
      </div>
    );
  },
);

