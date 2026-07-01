# CSS cascade order

Порядок `@import` в `index.css` **не менять** без проверки каскада.

Манифест: [`scripts/css-segments.mjs`](../../scripts/css-segments.mjs). Проверка: `npm run verify:css`. Аудит дублей: `npm run audit:css`.

| # | Файл | Примечание |
|---|------|------------|
| 1 | `styles/tokens.css` | |
| 2 | `styles/base.css` | |
| 3 | `styles/layout/app-shell.css` | |
| 4 | `styles/components/forms.css` | |
| 5 | `styles/components/ant-btn-bridge.css` | Ant Design 6 button bridge |
| 6 | `styles/components/cards-tables.css` | Card, tables, projects-table |
| 7 | `styles/features/matrix.css` | Matrix + legacy native table (matrix-table only) |
| 8–19 | `styles/features/map/*.css` | Карта, ODP split (shell → fields → footer) |
| 20 | `styles/components/app-select.css` | |
| 21 | `styles/features/rates.css` | |
| 22 | `styles/features/parameters.css` | |
| 23 | `styles/features/dashboard.css` | |
| 24 | `styles/features/project-detail.css` | |
| 25 | `styles/features/flow-schematic.css` | **Misnamed:** app-header, topbar-search, assistant panel |
| 26 | `styles/features/task-log.css` | |
| 27 | `styles/components/page-chrome.css` | |
| 28–33 | `styles/components/app-modal/*.css` | core, confirm, flow-overlays, sand-logistics, overlays, pad-earthwork-sketch |
| 34 | `styles/features/flow-schematic-page.css` | `.flow-schematic-*` page/canvas (из flow-overlays) |
| 35 | `styles/responsive/projects-table.css` | Projects table @1200 + @1023 |
| 36 | `styles/responsive/shell-mobile.css` | Shell, dashboard, projects chrome @1023 |
| 37 | `styles/responsive/tables-mobile.css` | Cards, table-wrap @1023 |
| 38 | `styles/responsive/flow-mobile.css` | Flow schematic @1023 |
| 39 | `styles/responsive/map-mobile.css` | Map @1023 + @640 + desktop toggles |
| 40 | `styles/responsive/modal-mobile.css` | App modal bottom-sheet @1023 |
| 41 | `styles/features/one-pager.css` | |
| 42 | `styles/features/import-3d.css` | |
| 43 | `styles/features/export.css` | |
| 44 | `styles/features/admin-assistant.css` | |

Эталон: `styles/.snapshot-monolith.css`.

**Object detail panel:** `object-detail-shell.css` → `object-detail-fields.css` → `object-detail-footer.css` — не объединять без смены каскада.

**App modal:** `flow-overlays.css` — sand/flow canvas; page-level `.flow-schematic-*` — в `flow-schematic-page.css`.

**Responsive policy:** cross-feature mobile — `responsive/*-mobile.css`; feature breakpoints — в `features/<x>.css`.
