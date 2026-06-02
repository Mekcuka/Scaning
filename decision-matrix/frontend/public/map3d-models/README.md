# 3D map models (CC0)

Bundled low-poly **industrial** glTF models from [Kenney — City Kit (Industrial)](https://kenney.nl/assets/city-kit-industrial) (CC0).

| File | Use on map |
|------|------------|
| `facility-large.glb` | ГПЗ, НПЗ, крупные установки |
| `facility-medium.glb` | НС, КС, УКГ, ТСГ, площадки |
| `facility-compact.glb` | Вспомогательные здания, offplot |
| `substation.glb` | Подстанция |
| `stack-large.glb` | ГТЭС, ГПЭС, ВИЭС, ИЭ |
| `stack-medium.glb` | Средние дымовые трубы |
| `stack-small.glb` | Небольшие трубы |
| `tank.glb` | Узлы, резервуары, соединения |
| `oil-pump-jack.glb` | Нефтяной / газовый куст (`oil_pad`, `gas_pad`) — станок-качалка |
| `transmission-tower.glb` | Опоры ЛЭП (промежуточные вершины) |

Texture: `textures/colormap.png` (embedded in glb).

Licenses: `LICENSE-kenney.txt`, `LICENSE-ipoly3d-transmission-tower.txt`, `LICENSE-poly-google-oil-pump-jack.txt`.

To add more assets, place `.glb` here and register in `src/lib/map3d/map3dGltfAssets.ts`.
