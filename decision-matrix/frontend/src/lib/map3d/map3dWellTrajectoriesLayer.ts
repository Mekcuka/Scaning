import maplibregl, {
  type CustomLayerInterface,
  type CustomRenderMethodInput,
  type Map as MapLibreMap,
} from 'maplibre-gl';
import * as THREE from 'three';
import { MAP3D_WELL_TRAJECTORIES_LAYER_ID } from './map3dConfig';
import { createLineTubeGroup } from './map3dLineMeshes';
import {
  acquireMap3dThreeRenderer,
  finishMap3dThreeFrame,
  releaseMap3dThreeRenderer,
} from './map3dSharedRenderer';
import type {
  Map3dWellBottomholeInstance,
  Map3dWellTrajectoryInstance,
  Map3dWellTrajectoryLayerData,
} from './map3dWellTrajectoryInstances';
import { buildMap3dLinearFeatureMatrix } from './map3dThreeMatrix';

type CachedAnchor = {
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

function buildAnchorTransform(lon: number, lat: number, altitudeM: number): CachedAnchor {
  const mc = maplibregl.MercatorCoordinate.fromLngLat([lon, lat], altitudeM);
  return {
    translateX: mc.x,
    translateY: mc.y,
    translateZ: mc.z,
    scale: mc.meterInMercatorCoordinateUnits(),
  };
}

function hexToThreeColor(hex: string): THREE.Color {
  try {
    return new THREE.Color(hex);
  } catch {
    return new THREE.Color('#1565c0');
  }
}

function createBottomholeSphereGroup(
  inst: Map3dWellBottomholeInstance,
): { group: THREE.Group; anchorLon: number; anchorLat: number; anchorAlt: number } | null {
  const geom = new THREE.SphereGeometry(inst.radiusM, 14, 12);
  const mat = new THREE.MeshBasicMaterial({
    color: hexToThreeColor(inst.colorHex),
    transparent: true,
    opacity: 0.92,
    depthTest: false,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geom, mat);
  const group = new THREE.Group();
  group.add(mesh);
  return {
    group,
    anchorLon: inst.lon,
    anchorLat: inst.lat,
    anchorAlt: inst.altM,
  };
}

type RenderableItem = {
  key: string;
  group: THREE.Group;
  anchor: CachedAnchor;
};

export class Map3dWellTrajectoriesCustomLayer implements CustomLayerInterface {
  id = MAP3D_WELL_TRAJECTORIES_LAYER_ID;
  type: 'custom' = 'custom';
  renderingMode: '3d' = '3d';

  private map: MapLibreMap | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private camera = new THREE.Camera();
  private layerData: Map3dWellTrajectoryLayerData = {
    trajectories: [],
    bottomholes: [],
    planLines: [],
  };
  private renderables: RenderableItem[] = [];
  private visible = true;
  private lightsReady = false;

  private readonly projMatrix = new THREE.Matrix4();
  private readonly localMatrix = new THREE.Matrix4();
  private readonly rotX = new THREE.Matrix4();

  private ensureLights(): void {
    if (this.lightsReady) return;
    this.lightsReady = true;
    this.scene.add(new THREE.HemisphereLight(0xe8f0fa, 0x6e7a72, 0.55));
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.22));
    const sun = new THREE.DirectionalLight(0xfff4e8, 0.5);
    sun.position.set(0.35, 0.85, 0.55);
    this.scene.add(sun);
  }

  setVisible(v: boolean): void {
    this.visible = v;
    this.map?.triggerRepaint();
  }

  private addTubeRenderable(inst: Map3dWellTrajectoryInstance, keyPrefix: string): void {
    const built = createLineTubeGroup({
      path: inst.path,
      alts: inst.alts,
      radiusM: inst.radiusM,
      colorHex: inst.colorHex,
      opacity: inst.opacity,
      subtype: 'well_trajectory',
      selected: false,
    });
    if (!built) return;
    const anchor = buildAnchorTransform(built.anchorLon, built.anchorLat, built.anchorAlt);
    this.renderables.push({
      key: `${keyPrefix}:${inst.id}`,
      group: built.group,
      anchor,
    });
    this.scene.add(built.group);
  }

  private rebuildRenderables(): void {
    for (const r of this.renderables) {
      this.scene.remove(r.group);
      disposeGroup(r.group);
    }
    this.renderables = [];

    for (const inst of this.layerData.planLines) {
      this.addTubeRenderable(inst, 'plan');
    }
    for (const inst of this.layerData.trajectories) {
      this.addTubeRenderable(inst, 'traj');
    }
    for (const inst of this.layerData.bottomholes) {
      const built = createBottomholeSphereGroup(inst);
      if (!built) continue;
      const anchor = buildAnchorTransform(built.anchorLon, built.anchorLat, built.anchorAlt);
      this.renderables.push({
        key: `bh:${inst.id}`,
        group: built.group,
        anchor,
      });
      this.scene.add(built.group);
    }
  }

  /** @deprecated Use setLayerData */
  setInstances(instances: Map3dWellTrajectoryInstance[]): void {
    this.setLayerData({ trajectories: instances, bottomholes: [], planLines: [] });
  }

  setLayerData(data: Map3dWellTrajectoryLayerData): void {
    this.layerData = data;
    this.rebuildRenderables();
    this.map?.triggerRepaint();
  }

  onAdd(map: MapLibreMap, gl: WebGLRenderingContext | WebGL2RenderingContext): void {
    this.map = map;
    this.camera = new THREE.Camera();
    this.renderer = acquireMap3dThreeRenderer(map, gl);
    this.ensureLights();
    this.rebuildRenderables();
  }

  onRemove(): void {
    for (const r of this.renderables) disposeGroup(r.group);
    this.renderables = [];
    this.scene.clear();
    if (this.map) releaseMap3dThreeRenderer(this.map);
    this.renderer = null;
    this.map = null;
  }

  render(_gl: WebGLRenderingContext | WebGL2RenderingContext, options: CustomRenderMethodInput): void {
    if (!this.map || !this.renderer || !this.visible || this.renderables.length === 0) return;

    this.projMatrix.fromArray(options.defaultProjectionData.mainMatrix);

    for (const r of this.renderables) {
      buildMap3dLinearFeatureMatrix(r.anchor, 1, this.localMatrix, this.rotX);
      this.camera.projectionMatrix.copy(this.projMatrix).multiply(this.localMatrix);

      for (const other of this.renderables) other.group.visible = false;
      r.group.visible = true;

      this.renderer.resetState();
      this.renderer.clearDepth();
      this.renderer.render(this.scene, this.camera);
    }

    for (const r of this.renderables) r.group.visible = true;
    finishMap3dThreeFrame(this.renderer);
  }
}

export function ensureMap3dWellTrajectoriesLayer(
  map: MapLibreMap,
  layer: Map3dWellTrajectoriesCustomLayer,
): void {
  if (map.getLayer(MAP3D_WELL_TRAJECTORIES_LAYER_ID)) return;
  map.addLayer(layer);
}

export function removeMap3dWellTrajectoriesLayer(map: MapLibreMap): void {
  if (!map.getLayer(MAP3D_WELL_TRAJECTORIES_LAYER_ID)) return;
  map.removeLayer(MAP3D_WELL_TRAJECTORIES_LAYER_ID);
}

export function setMap3dWellTrajectoriesLayerVisible(
  layer: Map3dWellTrajectoriesCustomLayer,
  visible: boolean,
): void {
  layer.setVisible(visible);
}
