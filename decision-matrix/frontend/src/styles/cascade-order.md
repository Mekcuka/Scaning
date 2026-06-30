# CSS cascade order

Порядок `@import` в `index.css` **не менять** без проверки каскада.

Манифест: [`scripts/css-segments.mjs`](../../scripts/css-segments.mjs). Проверка: `npm run verify:css`.

| # | Файл | Примечание |
|---|------|------------|
| 1 | `styles/tokens.css` | монолит 3–40 |
| 2 | `styles/base.css` | 41–69 |
| 3 | `styles/layout/app-shell.css` | 70–96 |
| 4 | `styles/components/forms.css` | (legacy `buttons.css` удалён в B11) |
| 5 | `styles/components/cards-tables.css` | |
| 7 | `styles/features/matrix.css` | 351–810 |
| 8 | `styles/features/map/page-layout.css` | бывш. map-core 811–865 |
| 9 | `styles/features/map/layers-panel.css` | 866–1183 |
| 10 | `styles/features/map/canvas.css` | 1184–1207 |
| 11 | `styles/features/map/group-panel.css` | 1208–1500 |
| 12 | `styles/features/map/autoroad-panel.css` | 1501–2005 |
| 13 | `styles/features/map/object-detail-shell.css` | 2006–2634 (ODP shell) |
| 14 | `styles/features/map/sand-haul-leg-tables.css` | бывш. map-tools 2635–2707 |
| 15 | `styles/features/map/object-detail-fields.css` | 2708–2820 (ODP fields) |
| 16 | `styles/features/map/poi-create-form.css` | 2821–3142 |
| 17 | `styles/features/map/object-detail-footer.css` | 3143–3208 (ODP footer) |
| 18 | `styles/features/map/toolbar.css` | 3209–3307 |
| 19 | `styles/components/app-select.css` | 3308–3730 |
| 20 | `styles/features/rates.css` | 3731–3914 |
| 21 | `styles/features/parameters.css` | 3915–4225 |
| 22 | `styles/features/dashboard.css` | 4226–4618 |
| 23 | `styles/features/flow-schematic.css` | 4619–5170 |
| 24 | `styles/features/task-log.css` | 5171–5340 |
| 25 | `styles/components/page-chrome.css` | 5341–5383 |
| 26 | `styles/components/app-modal/core.css` | бывш. app-modal 5384–5470 |
| 27 | `styles/components/app-modal/flow-overlays.css` | 5471–5825 (flow + sand canvas) |
| 28 | `styles/components/app-modal/sand-logistics.css` | 5826–6154 (timeline) |
| 29 | `styles/components/app-modal/overlays.css` | 6155–6256 (toast, measure-label, sr-only) |
| 30 | `styles/responsive/projects-table.css` | 6257–6272 |
| 31 | `styles/responsive/mobile-global.css` | 6273–6769 (**до** one-pager/import-3d) |
| 32 | `styles/features/one-pager.css` | 6770–7139 |
| 33 | `styles/features/import-3d.css` | 7140–7991 |
| 34 | `styles/features/export.css` | 7992–8454 |
| 35 | `styles/features/admin-assistant.css` | 8455–9173 |

Эталон: `styles/.snapshot-monolith.css` (копия монолита до split).

**Object detail panel:** стили `.object-detail-panel*` разбиты на `object-detail-shell.css`, `object-detail-fields.css`, `object-detail-footer.css` из-за исторического порядка монолита; не объединять без смены каскада.

**App modal:** бывший `app-modal.css` → `components/app-modal/` (`core`, `flow-overlays`, `sand-logistics`, `overlays`). Часть `.flow-schematic-*` дублирует зону `flow-schematic.css` по порядку каскада — не переносить без verify.
