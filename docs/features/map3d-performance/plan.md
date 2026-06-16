# План: оптимизация 3D-карты

**Дата:** 2026-06-16  
**Статус:** ready for Builder

## Цель и границы

### В scope
- Single-pass рендер в трёх custom-слоях MapLibre + Three.js
- `setHighlight` без rebuild meshes при selection
- Viewport culling, tube LOD, InstancedMesh, quality presets UI
- Worker для геометрии труб
- Draco-сжатие GLB на upload + DRACOLoader на frontend

### Вне scope
- Замена MapLibre на другой движок
- Серверный tile-based 3D streaming

## Стек

| Компонент | Выбор |
|-----------|-------|
| Рендер | Three.js custom layers + shared WebGLRenderer |
| Instancing | THREE.InstancedMesh + instanceColor |
| Worker | Vite ES worker, sync fallback |
| Draco | Python `map3d_glb_optimize.py` (pygltflib meshopt fallback) |
| Prefs | localStorage `mapLayerPreferences.map3dQuality` |

## Фазы

1. Ядро: `map3dLayerRender.ts`, single-pass, selection/moveend fixes
2. Culling + LOD + instancing + UI quality
3. Worker + backend Draco
4. Reviewer + Integrator (CI, tests)

## Критерии готовности

- [ ] Single-pass: ≤2 render pass на custom-слой
- [ ] Selection не вызывает `rebuildSceneMeshes`
- [ ] `map3dQuality` в UI и prefs
- [ ] pytest + npm test зелёные
- [ ] Draco graceful fallback если encoder недоступен
