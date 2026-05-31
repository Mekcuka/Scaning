import maplibregl, {
  type CustomLayerInterface,
  type CustomRenderMethodInput,
  type Map as MapLibreMap,
} from 'maplibre-gl';
import * as THREE from 'three';
import { createLineTubeGroup } from './map3dLineMeshes';
import type { Map3dLineInstance } from './map3dLineInstances';
import { altitudeForModelPlacement } from './map3dModelsLayer';

export const MAP3D_LINES_LAYER_ID = 'dm-3d-lines';

const MODEL_ROTATE_X = Math.PI / 2;

type CachedLineAnchor = {
  translateX: number;
  translateY: number;
  translateZ: number;
  scale: number;
};

function disposeGroup(group: THREE.Group): void {
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    mesh.geometry?.dispose();
    const mat = mesh.material;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else mat?.dispose();
  });
}

/** `altitudeM` is already terrain + base (see buildMap3dLineInstances). */
function buildAnchorTransform(lon: number, lat: number, altitudeM: number): CachedLineAnchor {
  const mc = maplibregl.MercatorCoordinate.fromLngLat([lon, lat], altitudeM);
  return {
    translateX: mc.x,
    translateY: mc.y,
    translateZ: mc.z,
    scale: mc.meterInMercatorCoordinateUnits(),
  };
}

function applyLineMatrix(
  target: THREE.Matrix4,
  t: CachedLineAnchor,
  scaleMul: number,
  rotX: THREE.Matrix4,
): void {
  const s = t.scale * scaleMul;
  rotX.makeRotationAxis(new THREE.Vector3(1, 0, 0), MODEL_ROTATE_X);
  target
    .identity()
    .makeTranslation(t.translateX, t.translateY, t.translateZ)
    .scale(new THREE.Vector3(s, -s, s))
    .multiply(rotX);
}

export class Map3dLinesCustomLayer implements CustomLayerInterface {
  id = MAP3D_LINES_LAYER_ID;
  type: 'custom' = 'custom';
  renderingMode: '3d' = '3d';

  private map: MapLibreMap | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private camera = new THREE.Camera();
  private lineGroups = new Map<string, THREE.Group>();
  private anchorCache = new Map<string, CachedLineAnchor>();
  private instances: Map3dLineInstance[] = [];
  private visible = true;
  private moveEndHandler: (() => void) | null = null;

  private readonly projMatrix = new THREE.Matrix4();
  private readonly localMatrix = new THREE.Matrix4();
  private readonly rotX = new THREE.Matrix4();

  setVisible(v: boolean): void {
    this.visible = v;
    this.map?.triggerRepaint();
  }

  private refreshAltsFromTerrain(): void {
    const map = this.map;
    if (!map) return;
    for (const inst of this.instances) {
      inst.alts = inst.path.map((p) =>
        altitudeForModelPlacement(map, p[0], p[1], inst.baseM),
      );
    }
  }

  private rebuildAnchorCache(): void {
    const map = this.map;
    if (!map) return;
    this.anchorCache.clear();
    for (const inst of this.instances) {
      if (inst.path.length === 0) continue;
      this.anchorCache.set(
        inst.id,
        buildAnchorTransform(inst.path[0]![0], inst.path[0]![1], inst.alts[0] ?? inst.baseM),
      );
    }
  }

  setInstances(instances: Map3dLineInstance[]): void {
    this.instances = instances;
    this.rebuildAnchorCache();
    this.rebuildMeshes();
    this.map?.triggerRepaint();
  }

  private rebuildMeshes(): void {
    for (const g of this.lineGroups.values()) {
      this.scene.remove(g);
      disposeGroup(g);
    }
    this.lineGroups.clear();

    for (const inst of this.instances) {
      const built = createLineTubeGroup({
        path: inst.path,
        alts: inst.alts,
        radiusM: inst.radiusM,
        colorHex: inst.color,
        opacity: inst.opacity,
        subtype: inst.subtype,
        selected: inst.selected,
      });
      if (!built) continue;
      this.lineGroups.set(inst.id, built.group);
      this.scene.add(built.group);
    }
  }

  onAdd(map: MapLibreMap, gl: WebGLRenderingContext | WebGL2RenderingContext): void {
    this.map = map;
    this.camera = new THREE.Camera();
    this.renderer = new THREE.WebGLRenderer({
      canvas: map.getCanvas(),
      context: gl,
      antialias: true,
    });
    this.renderer.autoClear = false;
    this.rebuildAnchorCache();
    this.rebuildMeshes();

    this.moveEndHandler = () => {
      this.refreshAltsFromTerrain();
      this.rebuildAnchorCache();
      this.rebuildMeshes();
      map.triggerRepaint();
    };
    map.on('moveend', this.moveEndHandler);
  }

  onRemove(): void {
    if (this.map && this.moveEndHandler) this.map.off('moveend', this.moveEndHandler);
    this.moveEndHandler = null;
    for (const g of this.lineGroups.values()) disposeGroup(g);
    this.lineGroups.clear();
    this.anchorCache.clear();
    this.scene.clear();
    this.renderer?.dispose();
    this.renderer = null;
    this.map = null;
  }

  render(_gl: WebGLRenderingContext | WebGL2RenderingContext, options: CustomRenderMethodInput): void {
    if (!this.map || !this.renderer || !this.visible || this.instances.length === 0) return;

    this.projMatrix.fromArray(options.defaultProjectionData.mainMatrix);

    for (const inst of this.instances) {
      const group = this.lineGroups.get(inst.id);
      const anchor = this.anchorCache.get(inst.id);
      if (!group || !anchor) continue;

      const scaleMul = inst.selected ? 1.03 : 1;
      applyLineMatrix(this.localMatrix, anchor, scaleMul, this.rotX);
      this.camera.projectionMatrix.copy(this.projMatrix).multiply(this.localMatrix);

      for (const g of this.lineGroups.values()) g.visible = false;
      group.visible = true;

      this.renderer.resetState();
      this.renderer.clearDepth();
      this.renderer.render(this.scene, this.camera);
    }

    for (const g of this.lineGroups.values()) g.visible = true;
  }
}

export function ensureMap3dLinesLayer(map: MapLibreMap, layer: Map3dLinesCustomLayer): void {
  if (map.getLayer(MAP3D_LINES_LAYER_ID)) return;
  map.addLayer(layer);
}

export function setMap3dLinesLayerVisible(layer: Map3dLinesCustomLayer, visible: boolean): void {
  layer.setVisible(visible);
}
