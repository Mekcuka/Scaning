import maplibregl, {
  type CustomLayerInterface,
  type CustomRenderMethodInput,
  type Map as MapLibreMap,
} from 'maplibre-gl';
import * as THREE from 'three';
import {
  cloneGltfModelToHeight,
  applyGltfInstanceSelection,
  loadColoredGltfTemplate,
  scaleGltfGroupToHeightM,
} from './map3dGltfLoader';
import { buildMap3dLinearFeatureMatrix, buildMap3dPointModelMatrix } from './map3dThreeMatrix';
import {
  powerLineNodeTowerRenderHeightM,
  shouldRenderPointAsPowerLineTower,
} from './map3dPowerLineNodeModel';
import { clonePowerLineTowerToHeight } from './map3dPowerLineStyle';
import { effectiveRender3dHeightM } from './render3d';
import { createProceduralModelMesh } from './map3dModelMeshes';
import {
  acquireMap3dThreeRenderer,
  finishMap3dThreeFrame,
  releaseMap3dThreeRenderer,
} from './map3dSharedRenderer';
import type { Map3dModelInstance } from './map3dModelInstances';
import type { Map3dQuality } from './map3dQuality';
import {
  clearViewportCullFreezeForMap,
  freezeViewportCullForMap,
  isLonLatInExpandedBounds,
  shouldApplyViewportCull,
  viewportLoadMarginDegForMap,
} from './map3dViewportCull';
import {
  createInstancedMeshFromPrototype,
  disposeInstancedMesh,
  groupInstancesForInstancing,
  setInstancedMatrixAt,
} from './map3dModelInstancing';
import {
  cullingEnabledForQuality,
  resolveModelRepresentation,
  instancingEnabledForQuality,
} from './map3dQuality';
import { renderMap3dSceneOnce, type Map3dRenderItem } from './map3dLayerRender';
import { modelGroupFromPlacement, wrapModelWithPlacement } from './map3dModelPlacement';
import { createRepaintThrottler } from './map3dRepaintThrottle';

export const MAP3D_MODELS_LAYER_ID = 'dm-3d-models';

const IDENTITY_MATRIX = new THREE.Matrix4();

type MapWithTerrainQuery = MapLibreMap & {
  queryTerrainElevation?: (lngLat: [number, number]) => number | null | undefined;
};

type CachedModelTransform = {
  translateX: number;
  translateY: number;
  translateZ: number;
  scale: number;
};

type PlacementEntry = {
  placement: THREE.Group;
  localMatrix: THREE.Matrix4;
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

function disposePlacement(entry: PlacementEntry): void {
  const model = modelGroupFromPlacement(entry.placement);
  if (model) disposeGroup(model);
}

/** Sample terrain once per instance update (not every animation frame). */
export function altitudeForModelPlacement(
  map: MapLibreMap,
  lon: number,
  lat: number,
  baseM: number,
): number {
  const m = map as MapWithTerrainQuery;
  if (map.getTerrain() && typeof m.queryTerrainElevation === 'function') {
    const elev = m.queryTerrainElevation([lon, lat]);
    if (elev != null && Number.isFinite(elev)) return elev + baseM;
  }
  return baseM;
}

function buildCachedTransform(
  map: MapLibreMap,
  lon: number,
  lat: number,
  baseM: number,
): CachedModelTransform {
  const alt = altitudeForModelPlacement(map, lon, lat, baseM);
  const mc = maplibregl.MercatorCoordinate.fromLngLat([lon, lat], alt);
  return {
    translateX: mc.x,
    translateY: mc.y,
    translateZ: mc.z,
    scale: mc.meterInMercatorCoordinateUnits(),
  };
}

export class Map3dModelsCustomLayer implements CustomLayerInterface {
  id = MAP3D_MODELS_LAYER_ID;
  type: 'custom' = 'custom';
  renderingMode: '3d' = '3d';

  private map: MapLibreMap | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private camera = new THREE.Camera();
  private placementEntries = new Map<string, PlacementEntry>();
  private instancedMeshes = new Map<
    string,
    {
      mesh: THREE.InstancedMesh;
      instanceIds: string[];
      refHeightM: number;
      heightById: Map<string, number>;
    }
  >();
  private instancedInstanceIds = new Set<string>();
  private transformCache = new Map<string, CachedModelTransform>();
  private instances: Map3dModelInstance[] = [];
  private visible = true;
  private lightsAdded = false;
  private moveEndHandler: (() => void) | null = null;
  private moveStartHandler: (() => void) | null = null;
  private moveHandler: (() => void) | null = null;
  private lastTerrainTransformMs = 0;
  private meshLoadGeneration = 0;
  private selectedHighlightId: string | null = null;
  private quality: Map3dQuality = 'balanced';
  private cullingEnabled = true;
  private scheduleRepaint: (() => void) | null = null;

  private readonly projMatrix = new THREE.Matrix4();
  private readonly localMatrix = new THREE.Matrix4();
  private readonly rotX = new THREE.Matrix4();
  /** Culled instanced slots: off-map, not at scene origin (avoids depth junk). */
  private readonly hiddenInstanceMatrix = new THREE.Matrix4()
    .makeTranslation(0, -1e6, 0)
    .scale(new THREE.Vector3(0, 0, 0));

  setVisible(v: boolean): void {
    this.visible = v;
    this.map?.triggerRepaint();
  }

  setQuality(quality: Map3dQuality): void {
    if (this.quality === quality) return;
    const instancingWas = instancingEnabledForQuality(this.quality);
    this.quality = quality;
    this.cullingEnabled = cullingEnabledForQuality(quality);
    if (instancingWas !== instancingEnabledForQuality(quality)) {
      void this.rebuildSceneMeshes();
    } else {
      this.map?.triggerRepaint();
    }
  }

  setHighlight(id: string | null): void {
    if (this.selectedHighlightId === id) return;
    const prev = this.selectedHighlightId;
    this.selectedHighlightId = id;
    if (prev) this.applySelectionStyle(prev, false);
    if (id) this.applySelectionStyle(id, true);
    this.map?.triggerRepaint();
  }

  private applySelectionStyle(id: string, selected: boolean): void {
    const entry = this.placementEntries.get(id);
    if (!entry) return;
    const group = modelGroupFromPlacement(entry.placement);
    if (!group) return;
    const inst = this.instances.find((i) => i.id === id);
    if (inst?.catalog.gltfAssetId) {
      applyGltfInstanceSelection(group, selected);
    } else {
      group.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh || !(mesh.material instanceof THREE.MeshStandardMaterial)) return;
        mesh.material.emissive.set(selected ? '#ffffff' : '#000000');
        mesh.material.emissiveIntensity = selected ? 0.18 : 0;
      });
    }
  }

  private rebuildTransformCache(): void {
    const map = this.map;
    if (!map) return;
    this.transformCache.clear();
    for (const inst of this.instances) {
      this.transformCache.set(inst.id, buildCachedTransform(map, inst.lon, inst.lat, inst.baseM));
    }
  }

  private requestRepaint(): void {
    if (this.scheduleRepaint) this.scheduleRepaint();
    else this.map?.triggerRepaint();
  }

  setInstances(instances: Map3dModelInstance[]): void {
    this.instances = instances;
    this.rebuildTransformCache();
    void this.rebuildSceneMeshes();
  }

  private ensureLights(): void {
    if (this.lightsAdded) return;
    this.scene.add(new THREE.HemisphereLight(0xe8f0fa, 0x8a7d6e, 0.62));
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.28));
    const sun = new THREE.DirectionalLight(0xfff9f0, 0.55);
    sun.position.set(90, -70, 120);
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0xc5d8f0, 0.22);
    fill.position.set(-50, 55, 60);
    this.scene.add(fill);
    this.lightsAdded = true;
  }

  private instanceHeightM(inst: Map3dModelInstance): number {
    return effectiveRender3dHeightM({
      heightM: inst.heightM,
      baseM: inst.baseM,
      visible: true,
      scale: inst.scale,
    });
  }

  private isInstanceInLoadView(inst: Map3dModelInstance): boolean {
    if (!this.map) return true;
    return isLonLatInExpandedBounds(
      this.map,
      inst.lon,
      inst.lat,
      viewportLoadMarginDegForMap(this.map),
    );
  }

  private isInstanceVisibleForRender(inst: Map3dModelInstance): boolean {
    if (!this.map || !shouldApplyViewportCull(this.map, this.cullingEnabled)) return true;
    return isLonLatInExpandedBounds(this.map, inst.lon, inst.lat);
  }

  private proceduralPlaceholder(inst: Map3dModelInstance): THREE.Group {
    const heightM = this.instanceHeightM(inst);
    return createProceduralModelMesh(
      inst.catalog.template,
      heightM,
      inst.catalog.footprintScale,
      inst.color,
      this.selectedHighlightId === inst.id,
    );
  }

  private replaceInstancePlacement(id: string, modelGroup: THREE.Group): void {
    const prev = this.placementEntries.get(id);
    if (prev) {
      this.scene.remove(prev.placement);
      disposePlacement(prev);
    }
    const placement = wrapModelWithPlacement(modelGroup);
    const entry: PlacementEntry = { placement, localMatrix: new THREE.Matrix4() };
    this.placementEntries.set(id, entry);
    this.scene.add(placement);
    if (this.selectedHighlightId === id) {
      this.applySelectionStyle(id, true);
    }
    this.requestRepaint();
  }

  private clearAllMeshes(): void {
    for (const entry of this.placementEntries.values()) {
      this.scene.remove(entry.placement);
      disposePlacement(entry);
    }
    this.placementEntries.clear();

    for (const { mesh } of this.instancedMeshes.values()) {
      this.scene.remove(mesh);
      disposeInstancedMesh(mesh);
    }
    this.instancedMeshes.clear();
    this.instancedInstanceIds.clear();
  }

  private loadIndividualGltfInst(inst: Map3dModelInstance, gen: number): void {
    const assetId = inst.catalog.gltfAssetId;
    if (!assetId) return;
    if (this.placementEntries.has(inst.id) || this.instancedInstanceIds.has(inst.id)) return;
    const heightM = this.instanceHeightM(inst);
    void cloneGltfModelToHeight(assetId, inst.color, heightM, this.selectedHighlightId === inst.id)
      .then((group) => {
        if (gen !== this.meshLoadGeneration) {
          disposeGroup(group);
          return;
        }
        this.replaceInstancePlacement(inst.id, group);
      })
      .catch(() => {
        if (gen !== this.meshLoadGeneration) return;
        const placeholder = this.proceduralPlaceholder(inst);
        this.replaceInstancePlacement(inst.id, placeholder);
      });
  }

  private startInstancedBucket(
    bucket: { key: string; instances: Map3dModelInstance[] },
    gen: number,
  ): void {
    if (this.instancedMeshes.has(bucket.key)) return;
    if (!bucket.instances.some((i) => this.isInstanceInLoadView(i))) return;

    const first = bucket.instances[0]!;
    const assetId = first.catalog.gltfAssetId!;
    const refHeightM = this.instanceHeightM(first);
    const heightById = new Map(
      bucket.instances.map((inst) => [inst.id, this.instanceHeightM(inst)] as const),
    );

    for (const inst of bucket.instances) {
      this.instancedInstanceIds.add(inst.id);
    }

    const fallbackToIndividual = (): void => {
      for (const inst of bucket.instances) {
        this.instancedInstanceIds.delete(inst.id);
        this.loadIndividualGltfInst(inst, gen);
      }
    };

    void loadColoredGltfTemplate(assetId, first.color)
      .then((template) => {
        if (gen !== this.meshLoadGeneration) return;
        const colored = template.clone(true);
        scaleGltfGroupToHeightM(colored, refHeightM);
        const material = new THREE.MeshStandardMaterial({
          color: '#ffffff',
          vertexColors: true,
          roughness: 0.72,
          metalness: 0.05,
          transparent: false,
          opacity: 1,
          depthWrite: true,
          depthTest: true,
          side: THREE.FrontSide,
          polygonOffset: true,
          polygonOffsetFactor: 1,
          polygonOffsetUnits: 1,
        });
        const mesh = createInstancedMeshFromPrototype(colored, bucket.instances.length, material);
        if (!mesh) {
          fallbackToIndividual();
          return;
        }
        mesh.frustumCulled = false;
        this.instancedMeshes.set(bucket.key, {
          mesh,
          instanceIds: bucket.instances.map((i) => i.id),
          refHeightM,
          heightById,
        });
        this.scene.add(mesh);
        this.requestRepaint();
      })
      .catch(() => {
        if (gen !== this.meshLoadGeneration) return;
        fallbackToIndividual();
      });
  }

  private loadIndividualInst(inst: Map3dModelInstance, gen: number): void {
    if (gen !== this.meshLoadGeneration) return;
    if (this.instancedInstanceIds.has(inst.id)) return;
    if (!this.isInstanceInLoadView(inst)) return;

    const assetId = inst.catalog.gltfAssetId;
    const useGltf = assetId && resolveModelRepresentation(0, this.quality, true) === 'gltf';

    if (!assetId || !useGltf) {
      if (this.placementEntries.has(inst.id)) return;
      const placeholder = this.proceduralPlaceholder(inst);
      this.replaceInstancePlacement(inst.id, placeholder);
      return;
    }

    if (shouldRenderPointAsPowerLineTower(inst.subtype)) {
      if (this.placementEntries.has(inst.id)) return;
      const towerH = powerLineNodeTowerRenderHeightM(inst.heightM, inst.scale);
      void clonePowerLineTowerToHeight(towerH, this.selectedHighlightId === inst.id)
        .then((group) => {
          if (gen !== this.meshLoadGeneration) {
            disposeGroup(group);
            return;
          }
          this.replaceInstancePlacement(inst.id, group);
        })
        .catch(() => {
          if (gen !== this.meshLoadGeneration) return;
          this.replaceInstancePlacement(inst.id, this.proceduralPlaceholder(inst));
        });
      return;
    }

    this.loadIndividualGltfInst(inst, gen);
  }

  private loadPendingVisible(): void {
    const gen = this.meshLoadGeneration;
    const { buckets, individual } = groupInstancesForInstancing(this.instances, {
      enabled: instancingEnabledForQuality(this.quality),
    });

    for (const bucket of buckets) {
      this.startInstancedBucket(bucket, gen);
    }
    for (const inst of individual) {
      this.loadIndividualInst(inst, gen);
    }
  }

  private async rebuildSceneMeshes(): Promise<void> {
    const gen = ++this.meshLoadGeneration;
    this.clearAllMeshes();
    this.loadPendingVisible();
    if (gen === this.meshLoadGeneration) {
      this.requestRepaint();
    }
  }

  onAdd(map: MapLibreMap, gl: WebGLRenderingContext | WebGL2RenderingContext): void {
    this.map = map;
    this.camera = new THREE.Camera();
    this.scheduleRepaint = createRepaintThrottler(map);

    this.ensureLights();

    this.renderer = acquireMap3dThreeRenderer(map, gl);

    this.rebuildTransformCache();
    void this.rebuildSceneMeshes();

    this.moveStartHandler = () => {
      freezeViewportCullForMap(map);
    };
    map.on('movestart', this.moveStartHandler);

    this.moveEndHandler = () => {
      clearViewportCullFreezeForMap(map);
      this.rebuildTransformCache();
      this.loadPendingVisible();
      this.requestRepaint();
    };
    map.on('moveend', this.moveEndHandler);

    this.moveHandler = () => {
      if (!map.getTerrain()) return;
      const now = performance.now();
      if (now - this.lastTerrainTransformMs < 120) return;
      this.lastTerrainTransformMs = now;
      this.rebuildTransformCache();
      this.requestRepaint();
    };
    map.on('move', this.moveHandler);
  }

  onRemove(): void {
    if (this.map) {
      if (this.moveStartHandler) this.map.off('movestart', this.moveStartHandler);
      if (this.moveEndHandler) this.map.off('moveend', this.moveEndHandler);
      if (this.moveHandler) this.map.off('move', this.moveHandler);
      clearViewportCullFreezeForMap(this.map);
    }
    this.moveStartHandler = null;
    this.moveEndHandler = null;
    this.moveHandler = null;
    this.scheduleRepaint = null;

    this.clearAllMeshes();
    this.transformCache.clear();
    this.scene.clear();
    this.lightsAdded = false;
    if (this.map) releaseMap3dThreeRenderer(this.map);
    this.renderer = null;
    this.map = null;
    this.instances = [];
    this.visible = false;
    this.selectedHighlightId = null;
  }

  private buildPlacementMatrix(
    inst: Map3dModelInstance,
    scaleMul: number,
    target: THREE.Matrix4,
  ): void {
    const t = this.transformCache.get(inst.id);
    if (!t) return;
    if (shouldRenderPointAsPowerLineTower(inst.subtype)) {
      buildMap3dLinearFeatureMatrix(t, scaleMul, target, this.rotX);
    } else {
      buildMap3dPointModelMatrix(t, scaleMul, target, this.rotX);
    }
  }

  render(_gl: WebGLRenderingContext | WebGL2RenderingContext, options: CustomRenderMethodInput): void {
    if (!this.map || !this.renderer || !this.visible || this.instances.length === 0) return;

    this.projMatrix.fromArray(options.defaultProjectionData.mainMatrix);
    const items: Map3dRenderItem[] = [];

    for (const { mesh, instanceIds, refHeightM, heightById } of this.instancedMeshes.values()) {
      let anyVisible = false;
      for (let i = 0; i < instanceIds.length; i++) {
        const id = instanceIds[i]!;
        const inst = this.instances.find((x) => x.id === id);
        if (!inst || !this.isInstanceVisibleForRender(inst)) {
          setInstancedMatrixAt(mesh, i, this.hiddenInstanceMatrix);
          continue;
        }
        const t = this.transformCache.get(id);
        if (!t) continue;
        const heightM = heightById.get(id) ?? refHeightM;
        const scaleMul = this.selectedHighlightId === id ? 1.08 : 1;
        const heightScale = refHeightM > 0 ? heightM / refHeightM : 1;
        buildMap3dPointModelMatrix(t, scaleMul * heightScale, this.localMatrix, this.rotX);
        setInstancedMatrixAt(mesh, i, this.localMatrix);
        anyVisible = true;
      }
      if (anyVisible) {
        items.push({ group: mesh, localMatrix: IDENTITY_MATRIX, depthPass: 'opaque' });
      }
    }

    for (const inst of this.instances) {
      if (this.instancedInstanceIds.has(inst.id)) continue;
      if (!this.isInstanceVisibleForRender(inst)) continue;

      const entry = this.placementEntries.get(inst.id);
      const t = this.transformCache.get(inst.id);
      if (!entry || !t) continue;

      const scaleMul = this.selectedHighlightId === inst.id ? 1.08 : 1;
      this.buildPlacementMatrix(inst, scaleMul, entry.localMatrix);
      items.push({ group: entry.placement, localMatrix: entry.localMatrix, depthPass: 'opaque' });
    }

    if (items.length === 0) {
      finishMap3dThreeFrame(this.renderer);
      return;
    }

    renderMap3dSceneOnce(this.renderer, this.scene, this.camera, this.projMatrix, items);
    finishMap3dThreeFrame(this.renderer);
  }
}

export function ensureMap3dModelsLayer(map: MapLibreMap, layer: Map3dModelsCustomLayer): void {
  if (map.getLayer(MAP3D_MODELS_LAYER_ID)) return;
  map.addLayer(layer);
}

/** Detach custom layer so the next enable runs a fresh onAdd/WebGL setup. */
export function removeMap3dModelsLayer(map: MapLibreMap): void {
  if (!map.getLayer(MAP3D_MODELS_LAYER_ID)) return;
  map.removeLayer(MAP3D_MODELS_LAYER_ID);
}

export function setMap3dModelsLayerVisible(layer: Map3dModelsCustomLayer, visible: boolean): void {
  layer.setVisible(visible);
}
