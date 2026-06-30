# Журнал реализации: Ant Design 6

## B1 — Foundation (2026-06-30)

- `antd@^6.5.0`, `@ant-design/icons` в `package.json`
- `src/lib/antTheme.ts` — маппинг tokens → ThemeConfig
- `src/providers/AntThemeProvider.tsx` — ConfigProvider + App + ru_RU
- `src/providers/ToastBridge.tsx` — pushToast → message API
- `App.tsx` — обёртка AntThemeProvider

## B2 — Shell (2026-06-30)

- `AppLayout.tsx` → Ant `Layout` / `Sider` / `Menu` / `Header` / `Drawer`
- `SubnavTabs.tsx` — общий компонент на Ant `Tabs`
- `ParametersLayout`, `DataLayout`, `AdminLayout`, `PadClusteringLayout`, `FlowSchematicLayout` — subnav на Tabs

## B3 — Примитивы (2026-06-30)

- `AppModal` → Ant `Modal`
- `AppSelect` → Ant `Select` (+ `Space.Compact` для icon)
- `ToastStack` → no-op; `ToastBridge` + `message`
- `PageSkeleton` → Ant `Skeleton`
- `DeferredNumberInput` → Ant `Input`
- `renderWithProviders` — обёртка `AntThemeProvider`

## B4–B7 — Страницы и панели (2026-06-30)

- `LoginPage`, `RegisterPage` — Ant Form/Input/Button/Card
- `ProjectsPage` — Ant Button/Card/Spin (частично)
- `FlowSchematicLayout` — Card/Alert/Tabs
- `PadClusteringLayout` — Ant Button в toolbar
- `panelUi.PanelSwitch` → Ant `Switch`
- Legacy `.btn` / `.card` на карте и остальных экранах — сосуществуют (следующие итерации)

## B8 — CSS (2026-06-30)

- Ant overrides в `page-chrome.css`; manifest синхронизирован с `index.css` (37 сегментов)
- Snapshot `.snapshot-monolith.css` регенерирован
- Legacy CSS сегменты сохранены для карты / flow / coexistence

## B9 — Плоские CRUD-страницы (2026-06-30)

- `DashboardPage` — Ant `Button`/`Card` в таблице проектов
- `AdminJobsPage` — Ant `Card`/`Button`/`Select`/`Input`/`Tag`/`Spin`
- `MatrixPage` — toolbar и empty/table на `Button`/`Card`
- `ExportPage` — кнопки выгрузки на Ant `Button`
- `ProjectDetailPage` — кнопки анализа и навигации на `Button`
- `ProjectsPage` — modal footer и действия в таблице на `Button`
- `ErrorPanel` → Ant `Alert` + `Button`
- `DeleteProjectConfirmModal` → Ant `Button` (danger primary)
- Карта, map toolbars, ~80 компонентов с `.btn` — следующая итерация B10

## B10 — Компоненты и панели (2026-06-30, пакет 1)

- Confirm-модалки: `DeleteChatConfirmModal`, `LineSplitConfirmModal`, `AutoroadConnectConfirmModal`, `InfraCapacityModal`, `FootprintTemplateApplyConfirmModal`
- Панели: `TaskLogPanel`, `AssistantPanel`, `ObjectDetailPanelHeader`/`Footer`, `ErrorBoundary`, `TableExcelExportButton`, `DevPortBanner`
- Страницы: `RatesPage`, `ImportPage`, `ReportListPage`, parameters-страницы, `FootprintConnectionsParametersPage`
- Остаётся: map toolbars, pad-earthwork/pad-clustering toolbars, `AutoroadNetworkPanel`, flow schematic editor, import sections

## B10 — пакет 2 (2026-06-30)

- Admin: `AdminAssistantPage`, `AdminAssistantOverrideForm`, `AdminAssistantHelpTab`, `WikiRagHelpModal`
- Import: `ImportFilesSection`, `ImportConnectionsSection`, `ImportWellSurveysSection`, `Import3DPage`
- Report: `ReportEditorPage`, `OnePagerPreview`, `ReportListPage` (доп.)
- Flow: `FlowSchematicEditorPanel`, `FlowSchematicEditPanel`
- Карта (chrome): `MapPageAnalyzeActions`, `MapPageToolbarEditGroup`, `DrawActions`, `ViewGroup`, `MapLayersPanel`, `AutoroadNetworkPanel`
- Object detail: траектории, earthwork, footprint connections, copy-кнопки
- Остаётся: `MapPageToolbarDrawGroup`, pad-earthwork/pad-clustering toolbars, `MapGroupSelectionPanel`, `PadPlacementPanel`, logistics, `FootprintLineConnectionTemplateForm`

## B10 — пакет 3 (2026-06-30)

- Карта: `MapToolbarButton` helper, `MapPageToolbarDrawGroup`, `MapGroupSelectionPanel`, `PadPlacementPanel`, `MapPageModals`, `FlowSchematicMobileBanner`
- Pad clustering: `PadClusteringTrajectorySection`, `PadClusteringSummaryTable`, `PadClusteringBottomholesSection`, `PadClusteringPyWellGeoPanel` (+ `GeoActionButton`)
- Pad earthwork: `PadEarthworkSketchModal`, `PlanGeneratorPanel`
- Autoroad: `AutoroadNetworkParamsSection` (scope/solver toggles через `MapToolbarButton`)
- Logistics/flows: `FlowLogisticsPage`, `SandVolumeYearPlanEditor`, `SandLogisticsDisplayOptions`, `EconomicFlowSchematic`
- Parameters/forms: `ProjectDistanceDefaultsForm`, `PoiParamsPanel`, `FootprintLineConnectionTemplateForm`, `GlbUploadZone`
- **Все `btn btn-*` в `src/` заменены** — остаются только кастомные классы (`map-display-mode-btn`, `poi-create-form__fluid-btn`, `pad-earthwork-sketch-modal__shape-btn`, compass-кнопки footprint)
- Следующий шаг B11: вычистка неиспользуемых legacy CSS-сегментов `.btn`/`.card` после проверки snapshot

## B11 — CSS cleanup (2026-06-30)

- Удалён `styles/components/buttons.css` (legacy `.btn`/`.btn-primary`/…)
- Контекстные селекторы переведены на `.ant-btn` / `.ant-btn-sm` / `.ant-btn-default` (matrix, object-detail, parameters, flow-schematic, admin-assistant, mobile-global, map toolbar)
- `css-segments.mjs` + `index.css`: 37 сегментов (было 38)
- Snapshot `.snapshot-monolith.css` регенерирован, `verify:css` — OK
- `.card` оставлен: ещё используется в layout-обёртках (~30 экранов); миграция на Ant `Card` — отдельная итерация

## B12 — Card migration, пакет 1 (2026-06-30)

- Параметры: `ParametersPage`, `SandParametersPage`, `EarthworkParametersPage`, `EntryDatesParametersPage`, `FootprintConnectionsParametersPage`
- Ставки: `RatesPage`, `ProjectDistanceDefaultsForm`
- Импорт/экспорт: `ImportFilesSection`, `ImportConnectionsSection`, `ImportWellSurveysSection`, `ImportHistorySection`, `ImportProjectPanel`, `ExportPage`, `ExportProjectPanel`
- Admin: `AdminUsersPage`, `AdminAssistantPage`, `AdminAssistantHelpTab`, `AdminAssistantOverrideForm`, `AdminAssistantConfigPanel`, `AdminAssistantProbePanel`
- Отчёты: `ReportListPage`, `ReportEditorPage`
- Проект: `ProjectDetailPage` (sidebar + panel)
- CSS bridge: `cards-tables.css` (`.ant-card.card--flush`), `admin-assistant.css`, `parameters.css`
- Остаётся: `MapPage`, flow pages (`FlowLogisticsPage`, `FlowTechnologyPage`, `FlowEconomicPage`), `MapAnalysisPanel`, `Import3dPanel`, `ExportOptionCard`, matrix-cards (domain-specific)

## B12 — Card migration, пакет 2 (2026-06-30)

- Карта: `MapPage` (flush layout, flex canvas chain), `MapAnalysisPanel` (`size="small"`)
- Flow: `FlowLogisticsPage`, `FlowTechnologyPage`, `FlowEconomicPage` — Ant `Card` + `flow-schematic-window`
- Импорт 3D: `Import3dPanel` — flush Card + `card-header`
- Экспорт: `ExportOptionCard` — Ant `Card`, убран legacy `.card`
- CSS bridge: `page-layout.css` (`.map-page-card.ant-card`), `export.css` (`.ant-card.export-option`), `cards-tables.css` (import-3d, flow-schematic-window)
- Остаётся: `matrix-card` (domain-specific), `card-header` как внутренний BEM в уже мигрированных Card

## B13 — CSS cleanup `.card` (2026-06-30)

- Удалены legacy `.card { … }` и standalone `.card--flush` из `cards-tables.css` (plain `div.card` в TSX нет)
- Bridge сохранён: `.ant-card.card--flush`, `.card-header`, `.ant-card.flow-schematic-window`, `.ant-card.card--flush .table-wrap`
- Убран дубль `.ant-card.import-3d-panel.card--flush` (покрывается общим flush)
- `mobile-global.css`: `.card` → `.ant-card:not(.card--flush) .ant-card-body` (mobile padding 14px)
- `admin-assistant.css`: селекторы только `.ant-card` (без `> .card`)
- `parameters.css`: `.rates-distance-card.ant-card .card-header h2`
- Snapshot регенерирован; `verify:css`, lint, test — OK
- `ui-guidelines.md`: Ant `Card` вместо legacy `.card`

## B14 — Legacy формы, пакет 1 (2026-06-30)

- Импорт: `ImportConnectionsSection` (Form.Item + Input/Input.Password), `ImportWellSurveysSection` (AppSelect), `GlbUploadZone` (InputNumber), `Import3DPage` (`form-label` → `import-3d-field-label`)
- Параметры: `ParametersPage`, `SandParametersPage`, `EarthworkParametersPage`, `EntryDatesParametersPage` — поиск на Ant `Input`, таблицы без `.input` на `DeferredNumberInput`/`Input type=date`
- Проект: `ProjectsPage` modal — Form.Item + Input/TextArea
- Admin: `AdminUsersPage` — роль через `AppSelect`
- Flow: `FlowLogisticsPage` — горизонт дат на Ant `Input size="small"`
- CSS: `forms.css` bridge `.ant-input` + модификаторы (`input--mono`, `input--w24`, …); `parameters.css`, `import-3d.css`, `cards-tables.css` (role select)
- Snapshot регенерирован; `verify:css`, lint, test 1271/1271 — OK
- Остаётся пакет 2: object-detail panel (~10), poiParamsForm (~7), pad-clustering panels, admin-assistant forms, flow schematic editor inputs, `SandVolumeYearPlanEditor`, `FootprintLineConnectionTemplateForm`, `ProjectDistanceDefaultsForm`; pad-earthwork sketch / `DimensionStepper` — по согласованию (кастомные)

## B14 — Legacy формы, пакет 2 (2026-06-30)

- Object detail: `InfraDetailMainTab`, `InfraPadEarthworkSectionForm`, `InfraBottomholeGeometrySection`, `InfraBottomholeDetailSection`, `InfraDetailLogisticsTab`, `InfraDetailExtraTab`, `InfraCapacityModal`, `PointFootprintLineConnectionsSection` — Ant `Input`/`Input.TextArea`; числа через `DeferredNumberInput` без legacy `.input`
- POI: `PoiCreateForm`, `PoiBasicFlatSection`, `PoiBasicAccordionSection`, `PoiNumberField`, `PoiCreateNumberField`, `PoiThresholdGrid`
- Pad clustering: `PadClusteringCalculationPanel`, `PadClusteringSettingsPanel`, `PadClusteringBottomholesSection` (select → `AppSelect`), `PadClusteringSummaryTable` — **не** `PadClusteringPyWellGeoPanel`
- Admin: `AdminAssistantOverrideForm` (`Input`/`Input.Password`), `AdminAssistantModelField` (`AppSelect` + `Input`)
- Flow/logistics: `FlowSchematicEditorPanel`, `AppSelectFluid`, `SandVolumeYearPlanEditor`, `FootprintLineConnectionTemplateForm`, `ProjectDistanceDefaultsForm` (bridge `.ant-input.rates-input`)
- CSS: `forms.css` — bridge pad-clustering, rates-input, admin mono, form-group Ant inputs
- Snapshot регенерирован; `verify:css`, lint, test 1271/1271 — OK
- Остаётся: `PadClusteringPyWellGeoPanel`, `PlanGeneratorPanel`, `DimensionStepper`, canvas/SVG-редакторы; при необходимости — `PoiThresholdAccordion`, `PoiEngineeringSection`

## B15 — CSS cleanup legacy форм (2026-06-30)

- `forms.css`: удалены глобальные `.input { … }`, `.input-sm`, `.input--fit`, `.form-group input/select/textarea` chrome; legacy scoped на `.pad-clustering-geo-panel .input`, pad-earthwork sketch/dim-stepper
- Bridge сохранён: `.ant-input` + модификаторы (`input--mono`, `input--w24`, `input--grow`, `rates-input`), pad-clustering/admin/form-group layout
- `parameters.css`: `.parameters-search .input` → только `.ant-input`; `rates-field` bridge на `.ant-input-number.rates-input`
- `rates.css`: `.ant-input-number.rates-input` рядом с `.rates-input`
- `cards-tables.css`: удалён мёртвый `.password-field` (нет в TSX); `.form-group` label layout сохранён для POI accordion
- Snapshot регенерирован; `verify:css`, lint, test — OK
- Следующий шаг: миграция `PadClusteringPyWellGeoPanel` / pad-earthwork sketch inputs на Ant (B16?) или Reviewer + коммит B9–B15

## Reviewer loop 1 — quick-fix (2026-06-30)

- `AppModal.tsx`: `overlayClassName` перенесён в `wrapClassName` (stacked/poi-create/sketch z-index)
- `ToastBridge.tsx`: CSS `.ant-message` bottom-right в `page-chrome.css` (без `message.config` — API hook не поддерживает)
- `PadClusteringLayout.tsx`: ссылка «Карта» через `navigate()` вместо `<Link><Button>`
