# Карта интеграции: Ant Design 6

## Точки входа

| Файл | Изменение |
|------|-----------|
| `frontend/src/main.tsx` | без изменений (data-theme) |
| `frontend/src/App.tsx` | обёртка `AntThemeProvider` |
| `frontend/src/providers/AntThemeProvider.tsx` | новый |
| `frontend/package.json` | `antd`, `@ant-design/icons` |

## CSS cleanup по фазам

| Фаза | Удалить/сократить |
|------|-------------------|
| B2 | `layout/app-shell.css` (частично) |
| B3 | `components/app-modal/core.css`, `app-select.css` |
| B4–B5 | `buttons.css`, `forms.css`, `cards-tables.css`, feature pages |
| B8 | остаток component CSS; оставить `features/map/*`, `flow-schematic.css`, `pad-earthwork-sketch.css`, `tokens.css` |

Manifest: `frontend/scripts/css-segments.mjs`

## E2E

- `frontend/e2e/helpers.ts` — role/`data-testid`
- Спеки: login, projects, parameters, map

## Backend

Изменений нет.
