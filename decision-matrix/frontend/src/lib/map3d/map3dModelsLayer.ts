import maplibregl, {
  type CustomLayerInterface,
  type CustomRenderMethodInput,
  type Map as MapLibreMap,
} from 'maplibre-gl';
import * as THREE from 'three';
import { cloneGltfModelToHeight } from './map3dGltfLoader';
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

export const MAP3D_MODELS_LAYER_ID = 'dm-3d-models';

type MapWithTerrainQuery = MapLibreMap & {
  queryTerrainElevation?: (lngLat: [number, number]) => number | null | undefined;
};

type CachedModelTransform = {
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
  private objectGroups = new Map<string, THREE.Group>();
  private transformCache = new Map<string, CachedModelTransform>();
  private instances: Map3dModelInstance[] = [];
  private visible = true;
  private lightsAdded = false;
  private moveEndHandler: (() => void) | null = null;
  private meshLoadGeneration = 0;

  private readonly projMatrix = new THREE.Matrix4();
  private readonly localMatrix = new THREE.Matrix4();
  private readonly rotX = new THREE.Matrix4();

  setVisible(v: boolean): void {
    this.visible = v;
    this.map?.triggerRepaint();
  }

  private rebuildTransformCache(): void {
    const map = this.map;
    if (!map) return;
    this.transformCache.clear();
    for (const inst of this.instances) {
      this.transformCache.set(inst.id, buildCachedTransform(map, inst.lon, inst.lat, inst.baseM));
    }
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

  private proceduralPlaceholder(inst: Map3dModelInstance): THREE.Group {
    const heightM = effectiveRender3dHeightM({
      heightM: inst.heightM,
      baseM: inst.baseM,
      visible: true,
      scale: inst.scale,
    });
    return createProceduralModelMesh(
      inst.catalog.template,
      heightM,
      inst.catalog.footprintScale,
      inst.color,
      inst.selected,
    );
  }

  private replaceInstanceGroup(id: string, group: THREE.Group): void {
    const prev = this.objectGroups.get(id);
    if (prev) {
      this.scene.remove(prev);
      disposeGroup(prev);
    }
    this.objectGroups.set(id, group);
    this.scene.add(group);
    this.map?.triggerRepaint();
  }

  private async rebuildSceneMeshes(): Promise<void> {
    const gen = ++this.meshLoadGeneration;

    for (const g of this.objectGroups.values()) {
      this.scene.remove(g);
      disposeGroup(g);
    }
    this.objectGroups.clear();

    for (const inst of this.instances) {
      if (gen !== this.meshLoadGeneration) return;

      const assetId = inst.catalog.gltfAssetId;
      if (!assetId) {
        const placeholder = this.proceduralPlaceholder(inst);
        this.objectGroups.set(inst.id, placeholder);
        this.scene.add(placeholder);
        continue;
      }

      const heightM = effectiveRender3dHeightM({
        heightM: inst.heightM,
        baseM: inst.baseM,
        visible: true,
        scale: inst.scale,
      });

      if (shouldRenderPointAsPowerLineTower(inst.subtype)) {
        const towerH = powerLineNodeTowerRenderHeightM(inst.heightM, inst.scale);
        void clonePowerLineTowerToHeight(towerH, inst.selected)
          .then((group) => {
            if (gen !== this.meshLoadGeneration) {
              disposeGroup(group);
              return;
            }
            this.replaceInstanceGroup(inst.id, group);
          })
          .catch(() => {
            if (gen !== this.meshLoadGeneration) return;
            const placeholder = this.proceduralPlaceholder(inst);
            this.objectGroups.set(inst.id, placeholder);
            this.scene.add(placeholder);
            this.map?.triggerRepaint();
          });
        continue;
      }

      void cloneGltfModelToHeight(assetId, inst.color, heightM, inst.selected)
        .then((group) => {
          if (gen !== this.meshLoadGeneration) {
            disposeGroup(group);
            return;
          }
          this.replaceInstanceGroup(inst.id, group);
        })
        .catch(() => {
          if (gen !== this.meshLoadGeneration) return;
          const placeholder = this.proceduralPlaceholder(inst);
          this.objectGroups.set(inst.id, placeholder);
          this.scene.add(placeholder);
          this.map?.triggerRepaint();
        });
    }

    this.map?.triggerRepaint();
  }

  onAdd(map: MapLibreMap, gl: WebGLRenderingContext | WebGL2RenderingContext): void {
    this.map = map;
    this.camera = new THREE.Camera();

    this.ensureLights();

    this.renderer = acquireMap3dThreeRenderer(map, gl);

    this.rebuildTransformCache();
    this.rebuildSceneMeshes();

    this.moveEndHandler = () => {
      this.rebuildTransformCache();
      map.triggerRepaint();
    };
    map.on('moveend', this.moveEndHandler);
  }

  onRemove(): void {
    if (this.map && this.moveEndHandler) {
      this.map.off('moveend', this.moveEndHandler);
    }
    this.moveEndHandler = null;

    for (const g of this.objectGroups.values()) disposeGroup(g);
    this.objectGroups.clear();
    this.transformCache.clear();
    this.scene.clear();
    this.lightsAdded = false;
    if (this.map) releaseMap3dThreeRenderer(this.map);
    this.renderer = null;
    this.map = null;
    this.instances = [];
    this.visible = false;
  }

  render(_gl: WebGLRenderingContext | WebGL2RenderingContext, options: CustomRenderMethodInput): void {
    if (!this.map || !this.renderer || !this.visible || this.instances.length === 0) return;

    this.projMatrix.fromArray(options.defaultProjectionData.mainMatrix);

    for (const inst of this.instances) {
      const group = this.objectGroups.get(inst.id);
      const t = this.transformCache.get(inst.id);
      if (!group || !t) continue;

      const scaleMul = inst.selected ? 1.08 : 1;
      if (shouldRenderPointAsPowerLineTower(inst.subtype)) {
        buildMap3dLinearFeatureMatrix(t, scaleMul, this.localMatrix, this.rotX);
      } else {
        buildMap3dPointModelMatrix(t, scaleMul, this.localMatrix, this.rotX);
      }

      this.camera.projectionMatrix.copy(this.projMatrix).multiply(this.localMatrix);

      for (const g of this.objectGroups.values()) g.visible = false;
      group.visible = true;

      this.renderer.resetState();
      this.renderer.clearDepth();
      this.renderer.render(this.scene, this.camera);
    }

    for (const g of this.objectGroups.values()) g.visible = true;
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
