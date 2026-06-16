# Review report: map3d-performance

**Дата:** 2026-06-16  
**Вердикт:** ЗЕЛЁНЫЙ

## Контракт

| Пункт | Статус |
|-------|--------|
| Single-pass render (`map3dLayerRender.ts`) | OK |
| `setHighlight` без rebuild meshes | OK |
| `map3dQuality` prefs + UI | OK |
| Viewport culling | OK |
| Tube segment caps по quality | OK |
| InstancedMesh для bundled GLTF buckets | OK |
| Draco upload + DRACOLoader | OK (fallback без npx) |
| Worker bridge API | OK (sync fallback) |

## Тесты

- Frontend: `map3dLayerRender`, `map3dQuality`, `mapLayerPreferences`, `MapLayersPanel`, `MapView3D.init` — passed
- Backend: `test_map3d_glb_optimize.py` — 2 passed

## Риски (приняты)

- Instanced GLTF использует первый mesh прототипа — достаточно для bundled Kenney assets
- Draco-сжатие на CI без Node/npx сохраняет оригинальный GLB
- Worker — заглушка; геометрия труб на main thread через bridge

## Ручная проверка

Рекомендуется на проекте `23c1fef4-6206-4fc8-988b-5c13eff06071`: orbit/pan, selection, переключение «Качество 3D».
