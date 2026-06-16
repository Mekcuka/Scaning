# Integration map: map3d-performance

## Frontend touchpoints

```
MapLayersPanel (quality radio)
  → mapLayerPreferences.map3dQuality
  → useMapPageOrchestrator / buildCanvasSection
  → MapPageCanvas → MapView3D
       → modelsLayer.setQuality / setZoom / setHighlight
       → linesLayer.setQuality / setHighlight
       → wellTrajectoriesLayer.setQuality
```

## Files modified

- `map3dLayerRender.ts` (new)
- `map3dModelsLayer.ts`, `map3dLinesLayer.ts`, `map3dWellTrajectoriesLayer.ts`
- `map3dViewportCull.ts`, `map3dModelLod.ts`, `map3dModelInstancing.ts` (new)
- `map3dLineGeometry.worker.ts`, `map3dLineGeometryBridge.ts` (new)
- `map3dLineMeshes.ts`, `map3dGltfLoader.ts`
- `MapView3D.tsx`, `MapLayersPanel.tsx`, `mapLayerPreferences.ts`
- orchestrator sections, `MapPageCanvas.tsx`

## Backend touchpoints

```
POST /projects/{id}/map3d-models (upload)
  → api_handlers.handle_upload
  → validate_glb_upload
  → optimize_glb_upload  (new)
  → write_model_file_atomic
```

## Recompress script (optional)

`scripts/recompress-map3d-glb.py` — batch recompress existing files in `data/map3d_models/`.

## CI

- Frontend: lint, test, MapLayersPanel.test.tsx
- Backend: `tests/test_map3d_glb_optimize.py`
