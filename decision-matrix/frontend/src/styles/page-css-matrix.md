# Матрица страниц → CSS

Ручной артефакт аудита. Глобальный бандл: [`index.css`](../index.css) + локально [`pad-clustering-page.css`](../pages/padClustering/pad-clustering-page.css).

| Маршрут | Компонент | Root class | Основной CSS | Responsive | Статус |
|---------|-----------|------------|--------------|------------|--------|
| `/login` | LoginPage | `auth-form` | `components/forms.css` | — | OK |
| `/register` | RegisterPage | `auth-form` | `components/forms.css` | — | OK |
| `/projects` | ProjectsPage | `projects-page` | `components/cards-tables.css` | `responsive/projects-table.css` | Консолидировано |
| `/projects/:id` | ProjectDetailPage | `project-detail-page` | `features/project-detail.css` | `project-detail.css` @960 | OK |
| `/dashboard/:id` | DashboardPage | `dashboard-page` | `features/dashboard.css` + cards-tables | projects-table | OK |
| `/map/:id` | MapPage | `map-page` | `features/map/*` (12 файлов) | `responsive/map-mobile.css` | Консолидировано |
| `/matrix/:id` | MatrixPage | — | `features/matrix.css` | matrix @900/1200 | OK |
| `/pad-clustering/workspace/:id` | PadClusteringWorkspacePage | `pad-clustering-page__layout` | `pad-clustering-page.css` (local) | в файле | OK |
| `/pad-clustering/summary/:id` | PadClusteringSummaryPage | `pad-clustering-summary` | local | в файле | OK |
| `/pad-clustering/profile/:id` | PadClusteringProfilePage | `pad-clustering-profile` | local | в файле | OK |
| `/parameters/*` | Parameters* | `parameters-page` | `features/parameters.css` | parameters @768–1200 | OK |
| `/parameters/rates/:id` | RatesPage | `rates-page` | `features/rates.css` | rates @media | OK |
| `/parameters/footprint-connections/:id` | FootprintConnectionsParametersPage | `footprint-connect-page` | `features/parameters.css` | — | OK |
| `/logistics/sand/:id` | SandParametersPage | `parameters-page` | parameters + sand modal | — | OK |
| `/logistics/schematic/:id` | FlowLogisticsPage | `flow-schematic-window` | flow-schematic-page + flow-overlays | flow-mobile | Консолидировано |
| `/flows/technology/:id` | FlowTechnologyPage | `flow-schematic-window` | flow-schematic-page | flow-mobile | Консолидировано |
| `/flows/economic/:id` | FlowEconomicPage | `flow-schematic-window` | flow-schematic-page | flow-mobile | Консолидировано |
| `/data/import/:id` | ImportPage | `import-page export-page` | `features/export.css` | export @640/1024 | Документирован шаринг |
| `/data/export/:id` | ExportPage | `export-page` | `features/export.css` | export @640/1024 | OK |
| `/data/import-3d/:id` | Import3DPage | `import-3d-page` | `features/import-3d.css` | import-3d @640/1024 | OK |
| `/report/:id` | ReportListPage | `page-toolbar` | `page-chrome.css` | shell-mobile | OK |
| `/report/new/:id`, `/report/:id/:id` | ReportEditorPage | `report-editor` | `features/one-pager.css` | one-pager @640+ | OK |
| `/admin/users` | AdminUsersPage | `admin-users-page` | cards-tables (scoped) | shell-mobile | Изолировано |
| `/admin/jobs` | AdminJobsPage | `admin-jobs-page` | cards-tables (scoped) | shell-mobile | Изолировано |
| `/admin/assistant` | AdminAssistantPage | `admin-assistant-page` | `features/admin-assistant.css` | admin @720+ | OK |

## Политика breakpoints

- **1200px** — таблица проектов, матрица (колонки)
- **1023px** — shell, flow/map mobile (`responsive/*-mobile.css`)
- **768 / 640** — feature-файлы (`parameters`, `export`, `one-pager`, …)

## Общие сегменты (все auth-страницы)

`tokens`, `base`, `layout/app-shell`, `forms`, `ant-btn-bridge`, `page-chrome`, `task-log`, `app-modal/*`, `responsive/shell-mobile.css`.
