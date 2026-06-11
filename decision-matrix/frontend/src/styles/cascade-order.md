# CSS cascade order

Порядок `@import` в `index.css` **не менять** без проверки каскада.

| # | Файл | Исходные строки (монолит) |
|---|------|---------------------------|
| 1 | `styles/tokens.css` | 3–40 |
| 2 | `styles/base.css` | 41–69 |
| 3 | `styles/layout/app-shell.css` | 70–96 |
| 4 | `styles/components/buttons.css` | 97–134 |
| 5 | `styles/components/forms.css` | 135–239 |
| 6 | `styles/components/cards-tables.css` | 240–350 |
| 7 | `styles/features/matrix.css` | 351–810 |
| 8 | `styles/features/map-core.css` | 811–2634 |
| 9 | `styles/features/map-tools.css` | 2635–3307 |
| 10 | `styles/components/app-select.css` | 3308–3730 |
| 11 | `styles/features/rates.css` | 3731–3914 |
| 12 | `styles/features/parameters.css` | 3915–4225 |
| 13 | `styles/features/dashboard.css` | 4226–4618 |
| 14 | `styles/features/flow-schematic.css` | 4619–5170 |
| 15 | `styles/features/task-log.css` | 5171–5340 |
| 16 | `styles/components/page-chrome.css` | 5341–5383 |
| 17 | `styles/components/app-modal.css` | 5384–6256 |
| 18 | `styles/responsive/projects-table.css` | 6257–6272 |
| 19 | `styles/responsive/mobile-global.css` | 6273–6769 |
| 20 | `styles/features/one-pager.css` | 6770–7139 |
| 21 | `styles/features/import-3d.css` | 7140–7991 |
| 22 | `styles/features/export.css` | 7992–8454 |
| 23 | `styles/features/admin-assistant.css` | 8455–9173 |

Эталон: `styles/.snapshot-monolith.css` (копия монолита до split).

Проверка: `node scripts/verify-css-cascade.mjs`
