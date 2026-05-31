import maplibregl, {
  type CustomLayerInterface,
  type CustomRenderMethodInput,
  type Map as MapLibreMap,
} from 'maplibre-gl';
import * as THREE from 'three';
import { createLineTubeGroup } from './map3dLineMeshes';
import { buildTransmissionTowerMesh, createPowerLineGroup } from './map3dPowerLineMeshes';
import { clonePowerLineTowerToHeight } from './map3dPowerLineStyle';
import type { Map3dLineInstance } from './map3dLineInstances';
import type { Map3dPowerLineInstance } from './map3dPowerLineInstances';
import type { Map3dLineLayerData } from './map3dLineLayerData';
import { buildNormalizedLinePath3d } from './map3dLinePathBuild';
import { resolvePowerLineEndpoints } from './map3dPowerLineEndpoints';
import type { InfraObject } from '../api';

export const MAP3D_LINES_LAYER_ID = 'dm-3d-lines';

const MODEL_ROTATE_X = Math.PI / 2;

/** Z mirror for linear 3D geometry only (tubes / ЛЭП), not point glTF models. */
const LINE_FLIP_Z_MATRIX = new THREE.Matrix4().makeScale(1, 1, -1);

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
    .multiply(rotX)
    .multiply(LINE_FLIP_Z_MATRIX);
}

type RenderableLine = {
  key: string;
  group: THREE.Group;
  anchor: CachedLineAnchor;
  selected: boolean;
};

export class Map3dLinesCustomLayer implements CustomLayerInterface {
  id = MAP3D_LINES_LAYER_ID;
  type: 'custom' = 'custom';
  renderingMode: '3d' = '3d';

  private map: MapLibreMap | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private camera = new THREE.Camera();
  private renderables: RenderableLine[] = [];
  private tubeInstances: Map3dLineInstance[] = [];
  private powerLineInstances: Map3dPowerLineInstance[] = [];
  private infraObjects: InfraObject[] = [];
  private snapPool: InfraObject[] | undefined;
  private powerLineMeshGeneration = 0;
  private visible = true;
  private moveEndHandler: (() => void) | null = null;

  private readonly projMatrix = new THREE.Matrix4();
  private readonly localMatrix = new THREE.Matrix4();
  private readonly rotX = new THREE.Matrix4();
  private lightsReady = false;

  private ensureLights(): void {
    if (this.lightsReady) return;
    this.lightsReady = true;
    this.scene.add(new THREE.HemisphereLight(0xe8f0fa, 0x6e7a72, 0.55));
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.22));
    const sun = new THREE.DirectionalLight(0xfff4e8, 0.5);
    sun.position.set(0.35, 0.85, 0.55);
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0xb8e8c8, 0.18);
    fill.position.set(-0.5, 0.25, -0.7);
    this.scene.add(fill);
  }

  setVisible(v: boolean): void {
    this.visible = v;
    this.map?.triggerRepaint();
  }

  private refreshAltsFromTerrain(): void {
    const map = this.map;
    if (!map) return;
    const pool = this.snapPool ?? this.infraObjects;

    for (const inst of this.tubeInstances) {
      const built = buildNormalizedLinePath3d(
        map,
        inst.line,
        this.infraObjects,
        inst.baseM,
        pool,
      );
      if (built) {
        inst.path = built.path;
        inst.alts = built.alts;
      }
    }
    for (const inst of this.powerLineInstances) {
      const built = buildNormalizedLinePath3d(
        map,
        inst.line,
        this.infraObjects,
        inst.baseM,
        pool,
      );
      if (built) {
        inst.path = built.path;
        inst.alts = built.alts;
      }
      const ep = resolvePowerLineEndpoints(
        map,
        inst.line,
        this.infraObjects,
        inst.path,
        inst.alts,
        pool,
      );
      inst.startWire = ep.startWire;
      inst.finishWire = ep.finishWire;
    }
  }

  private attachPowerLineTowers(
    built: NonNullable<ReturnType<typeof createPowerLineGroup>>,
    inst: Map3dPowerLineInstance,
    gen: number,
  ): void {
    const selected = inst.selected;
    const towerH = built.towerH;

    for (const slot of built.towerSlots) {
      void clonePowerLineTowerToHeight(towerH, selected)
        .then((tower) => {
          if (gen !== this.powerLineMeshGeneration) {
            disposeGroup(tower);
            return;
          }
          tower.position.copy(slot.position);
          built.group.add(tower);
          this.map?.triggerRepaint();
        })
        .catch(() => {
          if (gen !== this.powerLineMeshGeneration) return;
          const fallback = buildTransmissionTowerMesh(
            towerH,
            new THREE.Color('#7b8e9a'),
            selected,
          );
          fallback.position.copy(slot.position);
          built.group.add(fallback);
          this.map?.triggerRepaint();
        });
    }
  }

  private rebuildRenderables(): void {
    this.powerLineMeshGeneration++;
    const plGen = this.powerLineMeshGeneration;

    for (const r of this.renderables) {
      this.scene.remove(r.group);
      disposeGroup(r.group);
    }
    this.renderables = [];

    for (const inst of this.tubeInstances) {
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
      const anchor = buildAnchorTransform(built.anchorLon, built.anchorLat, built.anchorAlt);
      this.renderables.push({
        key: `tube:${inst.id}`,
        group: built.group,
        anchor,
        selected: inst.selected,
      });
      this.scene.add(built.group);
    }

    for (const inst of this.powerLineInstances) {
      const built = createPowerLineGroup({
        path: inst.path,
        alts: inst.alts,
        startWire: inst.startWire,
        finishWire: inst.finishWire,
        colorHex: inst.color,
        opacity: inst.opacity,
        towerHeightM: inst.towerHeightM,
        selected: inst.selected,
      });
      if (!built) continue;
      const anchor = buildAnchorTransform(built.anchorLon, built.anchorLat, built.anchorAlt);
      this.renderables.push({
        key: `pl:${inst.id}`,
        group: built.group,
        anchor,
        selected: inst.selected,
      });
      this.scene.add(built.group);
      this.attachPowerLineTowers(built, inst, plGen);
    }
  }

  setInstances(data: Map3dLineLayerData): void {
    this.tubeInstances = data.tubes;
    this.powerLineInstances = data.powerLines;
    this.infraObjects = data.infraObjects;
    this.snapPool = data.snapPool;
    this.refreshAltsFromTerrain();
    this.rebuildRenderables();
    this.map?.triggerRepaint();
  }

  /** @deprecated Use setInstances(Map3dLineLayerData) */
  setInstancesLegacy(tubes: Map3dLineInstance[]): void {
    this.setInstances({ tubes, powerLines: [], infraObjects: [] });
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
    this.ensureLights();
    this.rebuildRenderables();

    this.moveEndHandler = () => {
      this.refreshAltsFromTerrain();
      this.rebuildRenderables();
      map.triggerRepaint();
    };
    map.on('moveend', this.moveEndHandler);
  }

  onRemove(): void {
    if (this.map && this.moveEndHandler) this.map.off('moveend', this.moveEndHandler);
    this.moveEndHandler = null;
    for (const r of this.renderables) disposeGroup(r.group);
    this.renderables = [];
    this.scene.clear();
    this.renderer?.dispose();
    this.renderer = null;
    this.map = null;
  }

  render(_gl: WebGLRenderingContext | WebGL2RenderingContext, options: CustomRenderMethodInput): void {
    if (!this.map || !this.renderer || !this.visible || this.renderables.length === 0) return;

    this.projMatrix.fromArray(options.defaultProjectionData.mainMatrix);

    for (const r of this.renderables) {
      const scaleMul = r.selected ? 1.03 : 1;
      applyLineMatrix(this.localMatrix, r.anchor, scaleMul, this.rotX);
      this.camera.projectionMatrix.copy(this.projMatrix).multiply(this.localMatrix);

      for (const other of this.renderables) other.group.visible = false;
      r.group.visible = true;

      this.renderer.resetState();
      this.renderer.clearDepth();
      this.renderer.render(this.scene, this.camera);
    }

    for (const r of this.renderables) r.group.visible = true;
  }
}

export function ensureMap3dLinesLayer(map: MapLibreMap, layer: Map3dLinesCustomLayer): void {
  if (map.getLayer(MAP3D_LINES_LAYER_ID)) return;
  map.addLayer(layer);
}

export function setMap3dLinesLayerVisible(layer: Map3dLinesCustomLayer, visible: boolean): void {
  layer.setVisible(visible);
}
