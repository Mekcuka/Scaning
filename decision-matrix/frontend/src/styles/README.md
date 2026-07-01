# Frontend styles

Стили разбиты из монолитного `index.css`. **Порядок каскада** задан цепочкой `@import` в [`../index.css`](../index.css) — см. [cascade-order.md](./cascade-order.md).

Манифест сегментов: [`scripts/css-segments.mjs`](../../scripts/css-segments.mjs).

## Куда добавлять новые стили

| Тип | Файл |
|-----|------|
| Токены / тема | `tokens.css` |
| Reset, body | `base.css` |
| Shell layout | `layout/` |
| Кнопки, формы, модалки | `components/`; модалка + flow overlays → `components/app-modal/` |
| Экран / фича | `features/<feature>.css` |
| Карта (2D/3D) | `features/map/` — см. таблицу ниже |
| Глобальный responsive | `responsive/` — `projects-table`, `shell-mobile`, `tables-mobile`, `flow-mobile`, `map-mobile`, `modal-mobile` |

### `features/map/` — по префиксу класса

| Префикс / зона | Файл |
|----------------|------|
| `.map-page`, `.map-layout`, sidebar | `map/page-layout.css` |
| `.map-layers-*` | `map/layers-panel.css` |
| `.map-main-column`, `.map-canvas-wrap`, `.map-3d-host` | `map/canvas.css` |
| `.map-group-panel*` (не autoroad) | `map/group-panel.css` |
| `.autoroad-network-panel*`, `.autoroad-params*` | `map/autoroad-panel.css` |
| `.object-detail-panel` shell, tabs, grids | `map/object-detail-shell.css` |
| `.object-detail-panel__` поля, inputs | `map/object-detail-fields.css` + `map/object-detail-footer.css` |
| `.poi-create-form*`, POI modal overrides | `map/poi-create-form.css` |
| `.map-tools*`, `.map-tool-btn*` | `map/toolbar.css` |
| `.sand-haul-leg-*` | `map/sand-haul-leg-tables.css` (исторически в блоке map-tools; не менять порядок без verify) |

**ODP** намеренно в трёх файлах (`shell` → `fields` → … `poi-create` … → `footer`) — порядок каскада как в монолите.

### `components/app-modal/`

| Префикс / зона | Файл |
|----------------|------|
| `.app-modal-*` | `app-modal/core.css` |
| `.flow-schematic-*` page/canvas | `features/flow-schematic-page.css` |
| `.sand-logistics-flow-*`, `.sand-schematic-*` | `app-modal/flow-overlays.css` |
| `.sand-logistics-timeline*` | `app-modal/sand-logistics.css` |
| `.toast*`, `.measure-label`, `.sr-only`, mobile shell toggles | `app-modal/overlays.css` |

Правила именования: [ui-guidelines.md](../../../../docs/architecture/ui-guidelines.md) §6.

## Проверка после правок

```bash
npm run verify:css
npm run audit:css
npm run build
npm test
```

Sub-split существующего файла: `node scripts/split-css-file.mjs` (см. `scripts/run-map-css-split.mjs`).
