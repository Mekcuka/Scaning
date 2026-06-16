import maplibregl, {
  type CustomLayerInterface,
  type CustomRenderMethodInput,
  type Map as MapLibreMap,
} from 'maplibre-gl';
import * as THREE from 'three';
import { buildLineTubeGroupAsync } from './map3dLineGeometryBridge';
import { buildTransmissionTowerMesh, createPowerLineGroup } from './map3dPowerLineMeshes';
import { clonePowerLineTowerToHeight } from './map3dPowerLineStyle';
import {
  acquireMap3dThreeRenderer,
  finishMap3dThreeFrame,
  releaseMap3dThreeRenderer,
} from './map3dSharedRenderer';
import type { Map3dLineInstance } from './map3dLineInstances';
import type { Map3dPowerLineInstance } from './map3dPowerLineInstances';
import type { Map3dLineLayerData } from './map3dLineLayerData';
import { buildNormalizedLinePath3d } from './map3dLinePathBuild';
import { resolvePowerLineEndpoints } from './map3dPowerLineEndpoints';
import type { InfraObject } from '../api';
import { buildMap3dLinearFeatureMatrix } from './map3dThreeMatrix';
import { renderMap3dSceneOnce, type Map3dRenderItem } from './map3dLayerRender';
import type { Map3dQuality } from './map3dQuality';
import { cullingEnabledForQuality, tubeSegmentCapForQuality } from './map3dQuality';
import { isLonLatInExpandedBounds } from './map3dViewportCull';

export const MAP3D_LINES_LAYER_ID = 'dm-3d-lines';

type CachedLineAnchor = {
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

function buildAnchorTransform(lon: number, lat: number, altitudeM: number): CachedLineAnchor {
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

type RenderableLine = {
  key: string;
  group: THREE.Group;
  anchor: CachedLineAnchor;
  localMatrix: THREE.Matrix4;
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
  private tubeRebuildGeneration = 0;
  private visible = true;
  private moveEndHandler: (() => void) | null = null;
  private selectedHighlightId: string | null = null;
  private quality: Map3dQuality = 'balanced';
  private cullingEnabled = true;
  private tubularCap = 48;
  private lastAltSignature = '';

  private readonly projMatrix = new THREE.Matrix4();
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

  setQuality(quality: Map3dQuality): void {
    if (this.quality === quality) return;
    this.quality = quality;
    this.cullingEnabled = cullingEnabledForQuality(quality);
    this.tubularCap = tubeSegmentCapForQuality(quality);
    this.rebuildRenderables();
  }

  setHighlight(id: string | null): void {
    this.selectedHighlightId = id;
    this.map?.triggerRepaint();
  }

  private altSignature(): string {
    const parts: string[] = [];
    for (const inst of this.tubeInstances) parts.push(inst.alts.join(','));
    for (const inst of this.powerLineInstances) parts.push(inst.alts.join(','));
    return parts.join('|');
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
        inst.towerAlts = built.towerAlts;
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
    const selected = this.selectedHighlightId === inst.id;
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
    const tubeGen = ++this.tubeRebuildGeneration;

    for (const r of this.renderables) {
      this.scene.remove(r.group);
      disposeGroup(r.group);
    }
    this.renderables = [];

    void this.rebuildTubesAsync(tubeGen);

    for (const inst of this.powerLineInstances) {
      const built = createPowerLineGroup({
        path: inst.path,
        alts: inst.alts,
        towerAlts: inst.towerAlts,
        startWire: inst.startWire,
        finishWire: inst.finishWire,
        colorHex: inst.color,
        opacity: inst.opacity,
        towerHeightM: inst.towerHeightM,
        selected: this.selectedHighlightId === inst.id,
        quality: this.quality,
      });
      if (!built) continue;
      const anchor = buildAnchorTransform(built.anchorLon, built.anchorLat, built.anchorAlt);
      this.renderables.push({
        key: `pl:${inst.id}`,
        group: built.group,
        anchor,
        localMatrix: new THREE.Matrix4(),
      });
      this.scene.add(built.group);
      this.attachPowerLineTowers(built, inst, plGen);
    }

    this.lastAltSignature = this.altSignature();
  }

  private async rebuildTubesAsync(gen: number): Promise<void> {
    const jobs = this.tubeInstances.map(async (inst) => {
      const built = await buildLineTubeGroupAsync({
        path: inst.path,
        alts: inst.alts,
        radiusM: inst.radiusM,
        colorHex: inst.color,
        opacity: inst.opacity,
        subtype: inst.subtype,
        selected: this.selectedHighlightId === inst.id,
        tubularSegmentCap: this.tubularCap,
        quality: this.quality,
      });
      return { inst, built };
    });

    const results = await Promise.all(jobs);
    if (gen !== this.tubeRebuildGeneration) return;

    for (const { inst, built } of results) {
      if (!built) continue;
      const anchor = buildAnchorTransform(built.anchorLon, built.anchorLat, built.anchorAlt);
      const entry: RenderableLine = {
        key: `tube:${inst.id}`,
        group: built.group,
        anchor,
        localMatrix: new THREE.Matrix4(),
      };
      this.renderables.push(entry);
      this.scene.add(built.group);
    }
    this.map?.triggerRepaint();
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
    this.renderer = acquireMap3dThreeRenderer(map, gl);
    this.ensureLights();
    this.rebuildRenderables();

    this.moveEndHandler = () => {
      this.refreshAltsFromTerrain();
      const sig = this.altSignature();
      if (sig !== this.lastAltSignature) {
        this.rebuildRenderables();
      }
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
      const instId = r.key.split(':')[1] ?? '';
      const scaleMul = instId === this.selectedHighlightId ? 1.03 : 1;
      buildMap3dLinearFeatureMatrix(r.anchor, scaleMul, r.localMatrix, this.rotX);
      items.push({ group: r.group, localMatrix: r.localMatrix, depthPass: 'opaque' });
    }

    renderMap3dSceneOnce(this.renderer, this.scene, this.camera, this.projMatrix, items);
    finishMap3dThreeFrame(this.renderer);
  }
}

export function ensureMap3dLinesLayer(map: MapLibreMap, layer: Map3dLinesCustomLayer): void {
  if (map.getLayer(MAP3D_LINES_LAYER_ID)) return;
  map.addLayer(layer);
}

export function setMap3dLinesLayerVisible(layer: Map3dLinesCustomLayer, visible: boolean): void {
  layer.setVisible(visible);
}
