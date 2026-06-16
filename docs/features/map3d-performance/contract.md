# Контракт: map3d-performance

## Frontend — `map3dLayerRender.ts`

```typescript
export type Map3dRenderItem = {
  group: THREE.Group;
  localMatrix: THREE.Matrix4;
  renderOrder?: number;
  depthPass?: 'opaque' | 'overlay'; // overlay = depthTest false
};

export function applyInstanceMatrix(group: THREE.Group, localMatrix: THREE.Matrix4): void;
export function renderMap3dSceneOnce(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  projMatrix: THREE.Matrix4,
  items: Map3dRenderItem[],
): void;
```

## Custom layers — новые методы

```typescript
setHighlight(selectedId: string | null): void;
setQuality(quality: Map3dQuality): void;
setZoom(zoom: number): void; // для LOD/culling
```

## `mapLayerPreferences`

```typescript
export type Map3dQuality = 'full' | 'balanced' | 'performance';
// default: 'balanced'
```

## `map3dViewportCull.ts`

```typescript
export function isLonLatInExpandedBounds(
  map: MapLibreMap,
  lon: number,
  lat: number,
  marginDeg?: number,
): boolean;
```

## `map3dModelLod.ts`

```typescript
export function resolveModelRepresentation(
  zoom: number,
  quality: Map3dQuality,
  hasGltf: boolean,
): 'gltf' | 'procedural' | 'skip';
```

## Backend — `map3d_glb_optimize.py`

```python
def optimize_glb_upload(raw: bytes) -> tuple[bytes, bool]:
    """Returns (optimized_bytes, was_compressed). On failure returns (raw, False)."""
```

## Worker — `map3dLineGeometryBridge.ts`

```typescript
export function buildLineTubeGroupAsync(input: LineTubeBuildInput, tubularCap: number): Promise<...>;
export function buildLineTubeGroupSync(...): ...; // existing path
```
