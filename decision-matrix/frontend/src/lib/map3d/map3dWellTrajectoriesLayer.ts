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
import { renderMap3dSceneOnce, type Map3dRenderItem } from './map3dLayerRender';
import type { Map3dQuality } from './map3dQuality';
import { cullingEnabledForQuality, tubeSegmentCapForQuality } from './map3dQuality';
import { isLonLatInExpandedBounds } from './map3dViewportCull';

type CachedAnchor = {
  translateX: number;
  translateY: number;
  translateZ: number;
  scale: number;
  lon: number;
  lat: number;
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
    lon,
    lat,
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
  depthPass: 'opaque' | 'overlay';
  localMatrix: THREE.Matrix4;
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
  private quality: Map3dQuality = 'balanced';
  private cullingEnabled = true;
  private tubularCap = 48;

  private readonly projMatrix = new THREE.Matrix4();
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

  setQuality(quality: Map3dQuality): void {
    this.quality = quality;
    this.cullingEnabled = cullingEnabledForQuality(quality);
    this.tubularCap = tubeSegmentCapForQuality(quality);
    this.rebuildRenderables();
  }

  setHighlight(_id: string | null): void {
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
      tubularSegmentCap: this.tubularCap,
      quality: this.quality,
    });
    if (!built) return;
    const anchor = buildAnchorTransform(built.anchorLon, built.anchorLat, built.anchorAlt);
    this.renderables.push({
      key: `${keyPrefix}:${inst.id}`,
      group: built.group,
      anchor,
      depthPass: 'opaque',
      localMatrix: new THREE.Matrix4(),
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
      if (inst.path.length > 0) {
        this.addTubeRenderable(inst, 'plan');
      }
    }
    for (const inst of this.layerData.trajectories) {
      if (inst.path.length > 0) {
        this.addTubeRenderable(inst, 'traj');
      }
    }
    for (const inst of this.layerData.bottomholes) {
      const built = createBottomholeSphereGroup(inst);
      if (!built) continue;
      const anchor = buildAnchorTransform(built.anchorLon, built.anchorLat, built.anchorAlt);
      this.renderables.push({
        key: `bh:${inst.id}`,
        group: built.group,
        anchor,
        depthPass: 'overlay',
        localMatrix: new THREE.Matrix4(),
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
    const items: Map3dRenderItem[] = [];

    for (const r of this.renderables) {
      if (this.cullingEnabled && !isLonLatInExpandedBounds(this.map, r.anchor.lon, r.anchor.lat)) {
        continue;
      }
      buildMap3dLinearFeatureMatrix(r.anchor, 1, r.localMatrix, this.rotX);
      items.push({
        group: r.group,
        localMatrix: r.localMatrix,
        depthPass: r.depthPass,
      });
    }

    renderMap3dSceneOnce(this.renderer, this.scene, this.camera, this.projMatrix, items, {
      clearDepth: false,
    });
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
