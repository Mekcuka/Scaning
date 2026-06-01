import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  Box,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MousePointer2,
  RotateCw,
  Search,
} from 'lucide-react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { AppSelect } from '../AppSelect';
import type { InfraObject } from '../../lib/api';
import { SUBTYPE_LABELS } from '../../lib/api';
import { isLineSubtype } from '../../lib/infraGeometry';
import { MAP_SUBTYPE_COLORS } from '../../lib/mapIcons';
import { isCustomGltfAssetId } from '../../lib/map3d/map3dCustomAssets';
import { cloneGltfModelToHeight } from '../../lib/map3d/map3dGltfLoader';
import { resolveMap3dCatalog } from '../../lib/map3d/map3dModelInstances';
import {
  effectiveRender3dHeightM,
  RENDER_3D_STYLE_KEY,
  resolveRender3D,
  shouldUse3dModel,
} from '../../lib/map3d/render3d';

type Import3dPreviewProps = {
  objects: InfraObject[];
  /** Changes when project custom GLB list is synced (triggers model reload). */
  customModelsKey?: string;
};

type PreviewStatus = 'idle' | 'loading' | 'ready' | 'no-model' | 'extrusion' | 'error';

function pointObjects(objects: InfraObject[]): InfraObject[] {
  return objects.filter((o) => !isLineSubtype(o.subtype));
}

function objectOptionLabel(obj: InfraObject): string {
  const subtypeLabel = SUBTYPE_LABELS[obj.subtype] ?? obj.subtype;
  return `${obj.name} · ${subtypeLabel}`;
}

function normalizeSearch(s: string): string {
  return s.trim().toLowerCase();
}

function matchesSearch(obj: InfraObject, query: string): boolean {
  if (!query) return true;
  const subtypeLabel = SUBTYPE_LABELS[obj.subtype] ?? obj.subtype;
  const hay = `${obj.name} ${subtypeLabel} ${obj.subtype}`.toLowerCase();
  return hay.includes(query);
}

function modelSourceLabel(assetId: string | undefined): string {
  if (!assetId) return 'Процедурная';
  if (isCustomGltfAssetId(assetId)) return 'Своя GLB';
  return assetId;
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
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<PreviewStatus>('idle');
  const [modelLabel, setModelLabel] = useState('');

  const points = useMemo(() => pointObjects(objects), [objects]);
  const searchNorm = normalizeSearch(search);

  const filteredPoints = useMemo(
    () => points.filter((o) => matchesSearch(o, searchNorm)),
    [points, searchNorm],
  );

  const selectOptions = useMemo(
    () =>
      filteredPoints.map((o) => ({
        value: o.id,
        label: objectOptionLabel(o),
      })),
    [filteredPoints],
  );

  const selectedObject = useMemo(
    () => points.find((p) => p.id === objectId) ?? null,
    [points, objectId],
  );

  const selectedRender = useMemo(
    () =>
      selectedObject
        ? resolveRender3D(selectedObject.subtype, selectedObject.properties)
        : null,
    [selectedObject],
  );

  useEffect(() => {
    if (!objectId && points.length > 0) setObjectId(points[0]!.id);
    if (objectId && !points.some((p) => p.id === objectId)) {
      setObjectId(filteredPoints[0]?.id ?? points[0]?.id ?? '');
    }
  }, [points, filteredPoints, objectId]);

  useEffect(() => {
    if (searchNorm && objectId && !filteredPoints.some((p) => p.id === objectId)) {
      setObjectId(filteredPoints[0]?.id ?? '');
    }
  }, [searchNorm, filteredPoints, objectId]);

  const stepObject = useCallback(
    (delta: -1 | 1) => {
      const list = filteredPoints.length > 0 ? filteredPoints : points;
      if (list.length === 0) return;
      const idx = list.findIndex((p) => p.id === objectId);
      const next = idx < 0 ? 0 : (idx + delta + list.length) % list.length;
      setObjectId(list[next]!.id);
    },
    [filteredPoints, points, objectId],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return undefined;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const scene = new THREE.Scene();
    scene.background = null;

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

    const disposeSlot = () => {
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
    };

    disposeSlot();

    const obj = points.find((p) => p.id === objectId);
    if (!obj) {
      setStatus(points.length === 0 ? 'idle' : 'idle');
      setModelLabel('');
      return undefined;
    }

    const style = obj.properties?.[RENDER_3D_STYLE_KEY];
    if (style === 'extrusion' || !shouldUse3dModel(obj.subtype, obj.properties)) {
      setStatus('extrusion');
      setModelLabel('Экструзия / 2D');
      return undefined;
    }

    const catalog = resolveMap3dCatalog(obj.subtype, obj.properties);
    const assetId = catalog?.gltfAssetId;
    if (!assetId) {
      setStatus('no-model');
      setModelLabel('Нет 3D-модели');
      return undefined;
    }

    let cancelled = false;
    setStatus('loading');
    setModelLabel(modelSourceLabel(assetId));

    const run = async () => {
      const render = resolveRender3D(obj.subtype, obj.properties);
      const heightM = effectiveRender3dHeightM(render);
      const color = MAP_SUBTYPE_COLORS[obj.subtype] ?? '#607d8b';
      try {
        const group = await cloneGltfModelToHeight(assetId, color, heightM, false);
        if (cancelled || !sceneRef.current) {
          disposeGroup(group);
          return;
        }
        sceneRef.current.modelSlot.add(group);
        sceneRef.current.frameModel();
        setStatus('ready');
      } catch {
        if (!cancelled) setStatus('error');
      }
    };

    void run();
    return () => {
      cancelled = true;
      disposeSlot();
    };
  }, [objectId, points, customModelsKey]);

  const subtypeColor = selectedObject
    ? (MAP_SUBTYPE_COLORS[selectedObject.subtype] ?? '#607d8b')
    : '#94a3b8';

  return (
    <div className="import-3d-preview">
      <div className="import-3d-preview__toolbar">
        <div className="import-3d-preview__search-wrap">
          <Search className="import-3d-preview__search-icon" size={16} aria-hidden />
          <input
            type="search"
            className="import-3d-preview__search"
            placeholder="Поиск по имени или типу…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            disabled={points.length === 0}
            aria-label="Поиск объекта для превью"
          />
        </div>
        <div className="import-3d-preview__picker">
          <button
            type="button"
            className="import-3d-preview__nav"
            onClick={() => stepObject(-1)}
            disabled={points.length < 2}
            aria-label="Предыдущий объект"
          >
            <ChevronLeft size={18} aria-hidden />
          </button>
          <AppSelect
            className="import-3d-preview__select"
            variant="compact"
            fullWidth
            options={selectOptions}
            value={objectId}
            onChange={setObjectId}
            placeholder={points.length === 0 ? 'Нет точечных объектов' : 'Выберите объект'}
            disabled={points.length === 0}
            ariaLabel="Объект для просмотра"
            icon={<Box size={16} aria-hidden />}
          />
          <button
            type="button"
            className="import-3d-preview__nav"
            onClick={() => stepObject(1)}
            disabled={points.length < 2}
            aria-label="Следующий объект"
          >
            <ChevronRight size={18} aria-hidden />
          </button>
        </div>
        <p className="import-3d-preview__count" aria-live="polite">
          {points.length === 0
            ? 'В проекте нет точечных объектов'
            : searchNorm
              ? `Найдено ${filteredPoints.length} из ${points.length}`
              : `${points.length} объектов`}
        </p>
      </div>

      {selectedObject && selectedRender ? (
        <div className="import-3d-preview__meta">
          <span
            className="import-3d-preview__subtype"
            style={{ '--preview-subtype-color': subtypeColor } as CSSProperties}
          >
            <span className="import-3d-preview__subtype-dot" aria-hidden />
            {SUBTYPE_LABELS[selectedObject.subtype] ?? selectedObject.subtype}
          </span>
          <span className="import-3d-preview__chip">H {selectedRender.heightM} м</span>
          {selectedRender.scale !== 1 ? (
            <span className="import-3d-preview__chip">×{selectedRender.scale}</span>
          ) : null}
          {modelLabel ? (
            <span className="import-3d-preview__chip import-3d-preview__chip--model" title={modelLabel}>
              {modelLabel}
            </span>
          ) : null}
        </div>
      ) : null}

      <div
        ref={wrapRef}
        className={`import-3d-preview-canvas-wrap${status === 'loading' ? ' import-3d-preview-canvas-wrap--loading' : ''}`}
      >
        <canvas ref={canvasRef} className="import-3d-preview-canvas" />

        {status === 'loading' ? (
          <div className="import-3d-preview__overlay" aria-busy="true">
            <Loader2 className="import-3d-preview__overlay-icon import-3d-preview__spin" size={28} />
            <span>Загрузка модели…</span>
          </div>
        ) : null}

        {status === 'extrusion' ? (
          <div className="import-3d-preview__overlay import-3d-preview__overlay--muted">
            <span>Для объекта включена экструзия, а не glTF</span>
          </div>
        ) : null}

        {status === 'no-model' ? (
          <div className="import-3d-preview__overlay import-3d-preview__overlay--muted">
            <span>Нет подходящей 3D-модели для подтипа</span>
          </div>
        ) : null}

        {status === 'error' ? (
          <div className="import-3d-preview__overlay import-3d-preview__overlay--warn">
            <span>Не удалось загрузить модель</span>
          </div>
        ) : null}

        {status === 'ready' ? (
          <div className="import-3d-preview__hints" aria-hidden>
            <span>
              <RotateCw size={14} /> вращение
            </span>
            <span>
              <MousePointer2 size={14} /> масштаб
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function disposeGroup(group: THREE.Group): void {
  group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.geometry?.dispose();
      if (Array.isArray(mesh.material)) mesh.material.forEach((m) => m.dispose());
      else mesh.material?.dispose();
    }
  });
}
