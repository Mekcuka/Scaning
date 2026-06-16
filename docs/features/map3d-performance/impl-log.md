# Implementation log: map3d-performance

## Builder (фазы 1–6)

### Фаза 1 — batch-рендер моделей
- `map3dModelPlacement.ts` — `placementGroup` (mercator matrix) + inner `modelGroup` (glTF scale/anchor)
- `map3dModelsLayer.ts` — один `renderMap3dSceneOnce` pass вместо V× `clearDepth`+`render`
- Unit-тест: `map3dModelPlacement.test.ts`

### Фаза 2 — кэш и lazy load
- `map3dGltfLoader.ts` — `loadColoredGltfTemplate(assetId, colorHex)` кэш по ключу
- `map3dModelsLayer.ts` — загрузка только instances в viewport (+ zoom-aware margin); `moveend` догружает
- `map3dRepaintThrottle.ts` — один `triggerRepaint` на animation frame при пакетной async-загрузке

### Фаза 3 — GPU instancing
- `instancingEnabledForQuality('full')` → true
- Render-path: `InstancedMesh` + per-instance matrix (heightScale через matrix); cull → zero scale
- Individual path: custom GLB, power_line_node, singleton buckets

### Фаза 4 — culling и quality UI
- `map3dViewportCull.ts` — `viewportMarginDegForZoom` / `viewportMarginDegForMap`
- `MapLayersPanel.tsx` — подсказки: модели одинаковы на всех пресетах; quality влияет на линии/траектории

### Фаза 5 — worker для tube geometry
- `map3dLineTubeSerialize.ts` — сериализация буферов трубы
- `map3dLineGeometry.worker.ts` — `createLineTubeGroup` off main thread
- `map3dLineGeometryBridge.ts` — async API + sync fallback
- `map3dLinesLayer.ts` — `rebuildTubesAsync` с generation token

### Фаза 6 — polish
- `map3dLinesLayer.ts`, `map3dWellTrajectoriesLayer.ts` — `localMatrix` per renderable (без `Matrix4.clone()` per frame)
- `map3dRenderDebug.ts` + `VITE_MAP3D_DEBUG` — счётчик Three.js passes в `finishMap3dThreeFrame`

## Прочее (ранее)
- `map3dLayerRender.ts` — single-pass render helper (opaque + overlay)
- `setHighlight` / `setQuality`; MapView3D selection decoupled from mesh rebuild
- Backend `map3d_glb_optimize.py` + DRACOLoader
- Draco: requires `npx @gltf-transform/cli` locally; graceful fallback otherwise

## Метрики (ожидаемые)
- Models layer: 1 Three pass (individual) или 1 pass + instanced meshes на «Полном»
- Lines: 1 pass; tubes rebuild async в worker
- Dev: `VITE_MAP3D_DEBUG=true` → `[map3d] Three.js render passes: N` в консоли
