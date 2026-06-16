# Data model: map3d-performance

## Client prefs (`MapLayerPreferences`)

| Поле | Тип | Default | Persist |
|------|-----|---------|---------|
| `map3dQuality` | `'full' \| 'balanced' \| 'performance'` | `balanced` | localStorage per project |

## Quality presets

| Preset | Culling | Tube cap | Model LOD (zoom < 14) |
|--------|---------|----------|------------------------|
| `full` | off | 96 | gltf |
| `balanced` | on | 48 | gltf |
| `performance` | on | 24 | procedural |

## Instancing bucket key

`(gltfAssetId, colorHex, selectedBucket, heightBucket?)` — heightBucket округление для custom heights опционально; bundled assets по assetId+color.

## Render passes per layer

| Layer | Pass 1 | Pass 2 |
|-------|--------|--------|
| models | opaque instanced + groups | — |
| lines | all tubes | — |
| well trajectories | tubes + plan | bottomholes (depthTest false) |

## Backend GLB

Upload flow: `validate_glb_upload` → `optimize_glb_upload` → `write_model_file_atomic`.  
No DB schema change. `was_compressed` logged only.
