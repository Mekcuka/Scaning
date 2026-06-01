import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { InfraObject } from '../../lib/api';
import { isLineSubtype } from '../../lib/infraGeometry';
import { MAP_SUBTYPE_COLORS } from '../../lib/mapIcons';
import { cloneGltfModel } from '../../lib/map3d/map3dGltfLoader';
import { catalogEntryForModelId, catalogEntryForSubtype } from '../../lib/map3d/map3dModelCatalog';
import { resolveRender3D, RENDER_3D_MODEL_ID_KEY, shouldUse3dModel } from '../../lib/map3d/render3d';

type Import3dPreviewProps = {
  objects: InfraObject[];
  /** Changes when project custom GLB list is synced (triggers model reload). */
  customModelsKey?: string;
};

function pointObjects(objects: InfraObject[]): InfraObject[] {
  return objects.filter((o) => !isLineSubtype(o.subtype));
}

/** Fit perspective camera so the whole model is visible in the preview viewport. */
function frameModelInView(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  root: THREE.Object3D,
  margin = 1.4,
): void {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  if (box.isEmpty()) return;

  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 0.001);

  const vFovRad = (camera.fov * Math.PI) / 180;
  const distV = (margin * maxDim) / (2 * Math.tan(vFovRad / 2));
  const hFovRad = 2 * Math.atan(Math.tan(vFovRad / 2) * camera.aspect);
  const distH = (margin * maxDim) / (2 * Math.tan(hFovRad / 2));
  const distance = Math.max(distV, distH, 2);

  const dir = new THREE.Vector3(0.9, 0.45, 0.9).normalize();
  camera.position.copy(center).add(dir.multiplyScalar(distance));
  controls.target.copy(center);
  controls.minDistance = distance * 0.15;
  controls.maxDistance = distance * 8;
  camera.near = Math.max(distance / 200, 0.05);
  camera.far = Math.max(distance * 80, 300);
  camera.updateProjectionMatrix();
  controls.update();
}

export function Import3dPreview({ objects, customModelsKey = '' }: Import3dPreviewProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    controls: OrbitControls;
    modelSlot: THREE.Group;
    ground: THREE.Mesh;
    frameModel: () => void;
  } | null>(null);
  const [objectId, setObjectId] = useState('');
  const points = pointObjects(objects);

  useEffect(() => {
    if (!objectId && points.length > 0) setObjectId(points[0]!.id);
    if (objectId && !points.some((p) => p.id === objectId)) setObjectId(points[0]?.id ?? '');
  }, [points, objectId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return undefined;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#e8eef4');

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 500);
    camera.position.set(14, 10, 16);

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const sun = new THREE.DirectionalLight(0xfff8ee, 1.1);
    sun.position.set(10, 18, 8);
    scene.add(sun);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(1, 48),
      new THREE.MeshStandardMaterial({ color: '#9cb87a', roughness: 0.95 }),
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    const modelSlot = new THREE.Group();
    scene.add(modelSlot);

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;

    const frameModel = () => {
      if (modelSlot.children.length === 0) return;
      frameModelInView(camera, controls, modelSlot);
      const box = new THREE.Box3().setFromObject(modelSlot);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const radius = Math.max(Math.max(size.x, size.z) * 0.75, size.y * 0.15, 4);
      ground.scale.set(radius, radius, 1);
      ground.position.set(center.x, box.min.y, center.z);
    };

    sceneRef.current = { scene, camera, renderer, controls, modelSlot, ground, frameModel };

    const resize = () => {
      const w = Math.max(wrap.clientWidth, 1);
      const h = Math.max(wrap.clientHeight, 1);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      frameModel();
    };

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      controls.update();
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    const ctx = sceneRef.current;
    if (!ctx) return undefined;

    const obj = points.find((p) => p.id === objectId);
    while (ctx.modelSlot.children.length > 0) {
      const child = ctx.modelSlot.children[0]!;
      ctx.modelSlot.remove(child);
      child.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry?.dispose();
          if (Array.isArray(mesh.material)) mesh.material.forEach((m) => m.dispose());
          else mesh.material?.dispose();
        }
      });
    }

    if (!obj) return undefined;

    let cancelled = false;

    const run = async () => {
      const render = resolveRender3D(obj.subtype, obj.properties);
      const modelId = obj.properties?.[RENDER_3D_MODEL_ID_KEY];
      const useModel =
        shouldUse3dModel(obj.subtype, obj.properties) ||
        (typeof modelId === 'string' && modelId.trim().length > 0);
      if (!useModel) return;

      const catalog =
        typeof modelId === 'string' && modelId.trim()
          ? catalogEntryForModelId(modelId)
          : catalogEntryForSubtype(obj.subtype);
      const assetId = catalog?.gltfAssetId;
      if (!assetId) return;

      const color = MAP_SUBTYPE_COLORS[obj.subtype] ?? '#607d8b';
      try {
        const group = await cloneGltfModel(assetId, color, false);
        if (cancelled || !sceneRef.current) return;

        const box = new THREE.Box3().setFromObject(group);
        const h = Math.max(box.max.y - box.min.y, 0.001);
        const targetH = Math.max(render.heightM, 1) * render.scale;
        group.scale.multiplyScalar(targetH / h);
        group.updateMatrixWorld(true);
        const box2 = new THREE.Box3().setFromObject(group);
        group.position.y -= box2.min.y;

        sceneRef.current.modelSlot.add(group);
        sceneRef.current.frameModel();
      } catch {
        /* optional preview */
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [objectId, points, customModelsKey]);

  return (
    <div className="import-3d-preview">
      <label className="form-label" htmlFor="import3d-preview-object">
        Объект для просмотра
      </label>
      <select
        id="import3d-preview-object"
        className="form-control"
        value={objectId}
        onChange={(e) => setObjectId(e.target.value)}
        disabled={points.length === 0}
      >
        {points.length === 0 ? <option value="">Нет точечных объектов</option> : null}
        {points.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      <div ref={wrapRef} className="import-3d-preview-canvas-wrap">
        <canvas ref={canvasRef} className="import-3d-preview-canvas" />
      </div>
    </div>
  );
}
