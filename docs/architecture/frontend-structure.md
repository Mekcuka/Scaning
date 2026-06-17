# Структура frontend после рефакторинга карты (июнь 2026)

> См. также: [architecture.md](architecture.md) § Frontend, [module-boundaries.md](module-boundaries.md), [solid-refactoring-plan.md](../planning/solid-refactoring-plan.md), [testing-strategy.md](../testing/testing-strategy.md), [implementation-status.md](../planning/implementation-status.md).

Рефакторинг **не менял публичные импорты** — пути `../components/MapView`, `../lib/api`, `./map/MapPageToolbar` остались прежними. Логика вынесена в подмодули; страницы и хуки импортируют те же entry points.

**Тесты (июнь 2026):** **581/581** Vitest, **16** Playwright E2E; `npm run verify:css` — сверка каскада split CSS с эталоном.

## Сводка по размерам

| Модуль | Было (строк) | Стало | Примечание |
|--------|--------------|-------|------------|
| `pages/MapPage.tsx` | ~3836 | **~45** | Композиция layout; props через `sections` |
| `components/MapView.tsx` | ~2227 | **~58** | Обёртка над `mapView/*` |
| `components/ObjectDetailPanel.tsx` | ~1163 | **~168** | Обёртка над `objectDetailPanel/*` |
| `pages/map/MapPageToolbar.tsx` | 616 | **~147** | + 6 групп в `mapPageToolbar/` |
| `lib/api.ts` | ~1607 | **~20** | Barrel; доменные `*Api.ts` + compose `apiClient.ts` |
| `lib/sandLogisticsFlow.ts` | ~1735 | **1** | Barrel; код в `lib/sandLogisticsFlow/*` |
| `logistics/SandLogisticsFlowSchematic.tsx` | ~987 | **1** | Barrel; UI в `sandLogisticsFlowSchematic/*` |
| `logistics/SandLogisticsSubnetPanel.tsx` | ~179 | **2** | Barrel; UI в `sandLogisticsSubnetPanel/*` |
| `logistics/SandLogisticsTables.tsx` | ~178 | **2** | Barrel; таблицы в `sandLogisticsTables/*` |
| `lib/sandLogisticsResult.ts` | ~868 | **1** | Barrel; код в `sandLogisticsResult/*` |
| `components/FlowSchematicEditor.tsx` | ~851 | **1** | Barrel; UI в `flowSchematicEditor/*` |
| `hooks/useMapPageOrchestrator.ts` | ~882 | **1** | Barrel; код в `mapPageOrchestrator/*` |
| `src/index.css` | ~9170 | **~38** | `@import "tailwindcss"` + **35** сегментов `styles/*` (манифест `scripts/css-segments.mjs`) |

---

## Стили (`src/styles/`)

Монолитный `index.css` (~9.2k строк) разбит на слои **без смены className в TSX** (июнь 2026). Точка входа — [`index.css`](../../decision-matrix/frontend/src/index.css); порядок каскада — [`styles/cascade-order.md`](../../decision-matrix/frontend/src/styles/cascade-order.md).

| Каталог | Назначение | Примеры |
|---------|------------|---------|
| `tokens.css`, `base.css` | Переменные, reset, body | `:root`, `[data-theme="dark"]` |
| `layout/` | Shell | `.app-shell`, `.app-content` |
| `components/` | Примитивы | `.btn`, `.form-group`, `app-select`, `app-modal/` (core, flow-overlays, sand-logistics, overlays) |
| `features/` | Экраны и фичи | `map/` (11 файлов), `import-3d`, `export.css` (импорт + экспорт), `parameters`, `flow-schematic` |
| `responsive/` | Глобальный mobile | `mobile-global.css` **до** one-pager/import-3d в цепочке |

Проверка: `npm run verify:css`. Правила добавления стилей — [ui-guidelines.md](ui-guidelines.md) §6, [styles/README.md](../../decision-matrix/frontend/src/styles/README.md).

---

## Маршрутизация (React Router)

С июня 2026 проектные экраны используют **suffix-маршруты** — id проекта в **конце** пути: `/map/{projectId}`, `/parameters/rates/{projectId}`, … Глобальные маршруты без id: `/login`, `/register`, `/projects`, `/projects/:id`, `/admin/*`.

| Модуль | Назначение |
|--------|------------|
| [`lib/projectRoutes.ts`](../../decision-matrix/frontend/src/lib/projectRoutes.ts) | `projectPath()`, `stripProjectPrefix()`, `legacyPrefixToSuffixPath()` |
| [`ProjectRouteLayout.tsx`](../../decision-matrix/frontend/src/components/layout/ProjectRouteLayout.tsx) | Синхронизация URL ↔ store, проверка доступа к проекту |
| [`LegacyProjectRedirect.tsx`](../../decision-matrix/frontend/src/components/layout/LegacyProjectRedirect.tsx) | Редирект `/map` → `/map/{projectId}`; `LegacyPrefixRedirect` — `/{projectId}/map` → `/map/{projectId}` |
| [`ProjectLink.tsx`](../../decision-matrix/frontend/src/components/ProjectLink.tsx) | `<Link>` с автопрефиксом проекта |
| [`useProjectPath.ts`](../../decision-matrix/frontend/src/hooks/useProjectPath.ts) | `useProjectPathBuilder()` для `navigate()` |
| [`useActiveProject.ts`](../../decision-matrix/frontend/src/hooks/useActiveProject.ts) | `projectId` из URL (приоритет) или store |
| [`sectionNavMemory.ts`](../../decision-matrix/frontend/src/lib/sectionNavMemory.ts) | Память подвкладок — логический путь без id |
| [`resolvePageHeader.ts`](../../decision-matrix/frontend/src/lib/resolvePageHeader.ts) | Заголовок шапки по `stripProjectPrefix(pathname)` |

Пример: `http://localhost:5173/map/{uuid}`.

---

## `/map` — `MapPage` и `pages/map/`

`MapPage.tsx` — **единственный экспортируемый компонент страницы**. Не содержит вложенных `function`‑компонентов; layout собирается из дочерних модулей.

### UI-компоненты (`pages/map/`)

| Файл | Строк (≈) | Ответственность |
|------|-----------|-----------------|
| `MapPageToolbar.tsx` | 147 | Композиция тулбара |
| `mapPageToolbar/MapPageToolbarViewGroup.tsx` | 53 | 2D/3D, слои, fullscreen |
| `mapPageToolbar/MapPageToolbarEditGroup.tsx` | 116 | Edit, undo, copy/paste/cut, delete |
| `mapPageToolbar/MapPageToolbarDrawGroup.tsx` | 291 | Select, сеть, POI, точка/линия, линейка |
| `mapPageToolbar/MapPageToolbarDrawActions.tsx` | 68 | Назад / Готово / Сброс |
| `mapPageToolbar/MapPageToolbarSearch.tsx` | 85 | Поиск по объектам |
| `MapPageCanvas.tsx` | 266 | `MapView` (2D) / `MapView3D` |
| `MapPageSidePanels.tsx` | 164 | `ObjectDetailPanel`, группа, autoroad |
| `MapPageLayersSidebar.tsx` | 106 | Слои, радиусы, 3D-настройки |
| `MapPageFooter.tsx` | 102 | Масштаб, LOD, подсказки |
| `MapPageModals.tsx` | 124 | POI modal, delete, candidates |
| `MapPageHeader.tsx` | 53 | Заголовок + «Анализировать» |
| `MapPageEmptyProject.tsx` | 7 | Empty state без projectId |
| `PointSubtypeMenuItem.tsx` | 24 | Пункт меню подтипа точки |
| `mapConstants.ts` | 7 | Константы страницы |

### Вынесено из `MapPage.tsx` (июнь 2026)

- `map/MapPageHeader.tsx` — заголовок + кнопка «Анализировать»;
- `map/MapPageEmptyProject.tsx` — карточка «Выберите проект»;
- `hooks/mapPageOrchestrator/*` — оркестратор карты (см. ниже).

Inline: только `DevPortBanner`.

### Оркестратор карты — `mapPageOrchestrator/`

Публичный API: `import { useMapPageOrchestrator } from '../hooks/useMapPageOrchestrator'` — без изменений.

```
hooks/useMapPageOrchestrator.ts          # barrel (~1 строка)
hooks/mapPageOrchestrator/
├── useMapPageOrchestrator.ts           # композиция + return (~150)
├── useMapPageEditState.ts              # draw/selection/forms/modal state
├── useMapPageShellState.ts             # fullscreen, scale, refs
├── useMapPageMapData.ts                # queries, infra, search, undo
├── actions/                            # autoroad, draw, selection, analysis, display, interaction
├── useMapPageMapActions.ts             # compose (~35 строк)
├── buildMapPageSections.ts             # MapPageSections → props дочерних компонентов
└── submitPoi.ts                        # submit POI modal
```

`useMapPageOrchestrator()` возвращает `{ projectId, autoroadConfirmModal, mapCanvasRef, sections }`.
`MapPage.tsx` передаёт `{...sections.header}`, `{...sections.toolbar}` и т.д.
```

### Хуки карты (`src/hooks/`)

Бизнес-логика страницы — в dedicated hooks (импортируются в `MapPage`):

`useMapInfraData`, `useMapSelection`, `useMapSearchFilter`, `useMapClipboard`, `useMapLineDrawing`, `useMapDeleteSelection`, `useMapAnalysis`, `useMapInfraCreate`, `useMapDetailSave`, `useMapGeometrySave`, `useMapAutoroadNetwork`, `useMapFooterHint`, `useMap3dDisplay`, `useMapLayerPreferences`, `useMapDisplayMode`, `useProjectData` (pois/layers), `useActiveProject`, `useActiveProjectJob`, `useAutoroadConnectConfirm`.

Общие утилиты: `lib/mapHotkeys.ts`, `lib/mapUndo.ts`, `lib/mapQueries.ts`, `lib/mapHitTest.ts`.

---

## 2D-карта — `MapView` и `components/mapView/`

Публичный API: `components/MapView.tsx` (re-export типов + `memo(MapViewInner)`).

### Обёртка

```
components/MapView.tsx          # ~58 строк — hooks + div.map-container
```

### Модули `components/mapView/`

| Группа | Файлы | Назначение |
|--------|-------|------------|
| Типы и константы | `types.ts`, `constants.ts`, `mapViewRefs.ts` | Props, refs bundle |
| Pure helpers | `geometry.ts`, `featureSelection.ts`, `styles.ts`, `basemap.ts` | Стили, sync фич, basemap |
| Init OpenLayers | `setupOpenLayersMap.ts` | Оркестратор init (~61 строк) |
| Init submodules | `createMapLayers.ts`, `createOlMap.ts`, `bindDragPan.ts` | Слои и OlMap |
| Interactions | `setupSelectInteractions.ts`, `setupModifyHandlers.ts`, `setupTranslateHandlers.ts` | Select/Modify/Translate/DragBox |
| Modify submodules | `modifyHandlers/helpers.ts`, `onModifyStart.ts`, `onModifyEnd.ts` | Modify drag + line constraints |
| Translate submodules | `translateHandlers/readFeatureGeometry.ts`, `collectLinkedLinesForPoint.ts`, … | Box translate + linked lines |
| Events | `mapHitHelpers.ts`, `mapDrawHandlers.ts`, `setupMapClickHandlers.ts`, `setupPointerHandlers.ts`, `setupViewHandlers.ts` | Click, hover, view state |
| React hooks | `useMapViewRefs.ts`, `useMapViewInit.ts`, `useMapViewSnapIndex.ts`, `useMapViewReactiveEffects.ts` + `useMapViewViewState.ts`, `useMapViewInteractionState.ts`, `useMapViewSelectionSync.ts`, `useMapViewDataSync.ts`, `useMapViewOverlays.ts` | Reactive sync props → OL |

Поток инициализации:

```
useMapViewInit → setupOpenLayersMap
  → createMapLayers + createOlMap
  → setupSelectInteractions → setupModifyHandlers → setupTranslateHandlers
  → setupMapClickHandlers + setupPointerHandlers + setupViewHandlers
```

---

## Панель объекта — `ObjectDetailPanel` и `objectDetailPanel/`

Публичный API: `components/ObjectDetailPanel.tsx` (re-export `SelectedFeature`).

| Файл | Назначение |
|------|------------|
| `useObjectDetailPanel.ts` | Оркестратор (~95): композиция sub-hooks |
| `useObjectDetailFormState.ts` | useState + sync из selection |
| `useObjectDetailInfraDerived.ts` | derived flags, dirty, sand/capacity |
| `useObjectDetailPanelTabs.ts` | infra/poi tabs, tab dirty |
| `detailPanelSave.ts` | `buildDetailPanelSaveHandler` |
| `copyCoordinates.ts` | clipboard helper |
| `formState.ts` | `InfraFormDraft`, sync из selection |
| `infraSavePayload.ts` | `buildInfraSavePayload` |
| `detailDirty.ts` | `computeInfraIsDirty`, tab dirty |
| `useObjectDetailPanelKeyboard.ts` | Escape, Ctrl+S |
| `ObjectDetailPanelHeader.tsx` / `Footer.tsx` | Шапка и кнопки |
| `InfraDetailMainTab.tsx` | Подтип, слой, capacity, координаты |
| `InfraDetailLogisticsTab.tsx` | Песок, плечо возки |
| `InfraDetailExtraTab.tsx` | 3D + описание |
| `panelUi.tsx` | `PanelSection`, `DetailPanelTabs` |
| `constants.ts`, `helpers.ts`, `types.ts` | Вкладки POI/infra, dirty-check |

---

## HTTP-клиент — `lib/api.ts` и `lib/api/`

Публичный API: `import { api, POI, … } from '../lib/api'` — без изменений.

```
lib/api.ts                 # barrel (~10 строк)
lib/api/
├── apiClient.ts           # export const api = { … }
├── client.ts              # request(), CSRF, refresh (internal)
├── session.ts             # AuthUser, clearServerSession, …
├── entities.ts            # Project, POI, InfraObject, …
├── subtypes.ts            # SUBTYPE_LABELS, infraSubtypeSelectOptions, …
├── analysis.ts            # AnalysisRow, normalizePoiAnalysisResponse
├── jobs.ts, network.ts, sandLogistics.ts, importTypes.ts, onePager.ts
├── types.ts               # ApiHealthResponse, ApiErrorBody (codegen)
└── index.ts               # optional aggregate re-export
```

`request()` и CSRF остаются **внутренними** для `client.ts` — снаружи по-прежнему только `api` и типы.

---

## Shared data hooks

`hooks/useProjectData.ts` — `useProjectInfraObjects`, `useProjectPois`, `useProjectLayers` (используются на MapPage и страницах параметров/матрицы).

`hooks/useActiveProject.ts` — текущий `projectId`: приоритет у параметра `:projectId` в URL, иначе store + query списка проектов.

`lib/queryKeys.ts` — ключи TanStack Query для проектных сущностей.

---

## Песок / логистика — `sandLogisticsFlow` и `sandLogisticsFlow/`

Публичный API: `import { sandLogisticsToFlow, … } from '../lib/sandLogisticsFlow'` — без изменений.

```
lib/sandLogisticsFlow.ts          # barrel (~1 строка)
lib/sandLogisticsFlow/
├── types.ts, constants.ts, ids.ts
├── edgePaths.ts                  # SVG-пути рёбер
├── sliceKeys.ts                  # ключи топологии/slice, фильтры узлов
├── densityViewport.ts            # плотность, viewport
├── geoFrame.ts, geometry.ts      # гео-рамка и rect-helpers
├── roadGraph.ts, roadPolylines.ts
├── siteLayout.ts                 # resolveSiteLayout (~309 строк)
├── schematicNodes.ts             # скрытые якоря, lane offset
├── layout.ts                     # buildSandLogisticsLayout
├── sliceFlow.ts                  # buildSandLogisticsSliceFlow (~321)
├── toFlow.ts, metrics.ts
└── index.ts
```

Потребитель UI: `components/logistics/SandLogisticsFlowSchematic.tsx` (barrel). Тесты: `sandLogisticsFlow.test.ts` (30), `SandLogisticsSubnetPanel.test.tsx` (5).

### React Flow UI — `sandLogisticsFlowSchematic/`

| Файл | Строк (≈) | Ответственность |
|------|-----------|-----------------|
| `SandLogisticsFlowSchematic.tsx` | 39 | `ReactFlowProvider` + export |
| `SandLogisticsFlowSchematicInner.tsx` | 227 | layout/slice, prefs, summary |
| `SandLogisticsFlowCanvas.tsx` | 324 | canvas, drag overlap, edit panel |
| `edgeComponents.tsx` | 159 | custom edges + `edgeTypes` |
| `nodeComponents.tsx` | 128 | custom nodes + `nodeTypes` |
| `edgeLabelSvg.tsx` | 37 | общая подпись объёма на ребре |
| `SandSchematicLegend.tsx` | 42 | легенда |
| `context.tsx`, `SandFlowViewportSync.tsx`, … | — | контексты, viewport sync |

### Нормализация и prefs — `sandLogisticsResult/`

Публичный API: `import { normalizeSandLogisticsResult, … } from '../lib/sandLogisticsResult'`.

```
lib/sandLogisticsResult.ts          # barrel
lib/sandLogisticsResult/
├── normalize.ts                    # normalizeSandLogisticsResult (~177)
├── viewTimeline.ts                 # resolveSubnetsAtView, horizonYearRange, yearEndIso
├── schematicSlice.ts               # resolveSubnetForSchematicAtView, slice cache
├── warnings.ts                     # build*WarningLines, collectSandLogisticsWarningsAtView
├── sessionCache.ts                 # sessionStorage кэш результата
└── storagePrefs.ts                 # prefs схемы (line style, filters, horizon, …)
```

Тесты: `sandLogisticsResult.test.ts` (19), `useProjectSandLogistics.test.tsx` (5).

### Панель подсети — `sandLogisticsSubnetPanel/`

Публичный API: `SandLogisticsSubnetPanel`, `subnetTabLabel`, `subnetTabTitle` из `SandLogisticsSubnetPanel.tsx`.

```
logistics/SandLogisticsSubnetPanel.tsx     # barrel
logistics/sandLogisticsSubnetPanel/
├── types.ts
├── subnetTabLabels.ts
├── errorBoundaries.tsx                    # ChartsErrorBoundary, SchematicErrorBoundary
└── SandLogisticsSubnetPanel.tsx
```

### Таблицы — `sandLogisticsTables/`

```
logistics/SandLogisticsTables.tsx          # barrel
logistics/sandLogisticsTables/
├── formatters.ts                          # fmtKm, fmtM3, formatAllocationByYear
├── SandLogisticsConsumerTable.tsx
└── SandLogisticsQuarryTable.tsx
```

Тесты: `SandLogisticsSubnetPanel.test.tsx` (5), `FlowLogisticsPage.test.tsx` (2).

---

## Потоки (PFD) — `FlowSchematicEditor` и `flowSchematicEditor/`

Публичный API: `import { FlowSchematicEditor } from '../components/FlowSchematicEditor'` — без изменений.

Потребители: `pages/flows/FlowTechnologyPage.tsx`, моки в `FlowTechnologyPage.test.tsx`, `FlowSchematicLayout.test.tsx`.

```
components/FlowSchematicEditor.tsx          # barrel (~1 строка)
components/flowSchematicEditor/
├── types.ts                                # FlowSchematicEditorProps
├── helpers.ts                              # capacityValuesEqual, poiFlowContext, nodesToDto
├── FlowCapacityPopover.tsx                 # popover пропускной способности
├── FlowEdge.tsx                            # custom edge + label
├── FlowNode.tsx                            # custom node + separator
├── flowTypes.ts                            # nodeTypes, edgeTypes
├── AppSelectFluid.tsx                      # select флюида
├── FlowSchematicMobileBanner.tsx           # баннеры view/edit на мобильных
├── FlowSchematicEditorPanel.tsx            # панель редактирования + tools
├── FlowSchematicEditorInner.tsx            # state, React Flow canvas, providers
└── FlowSchematicEditor.tsx                 # ReactFlowProvider + export
```

Тесты: `pages/flows/*.test.tsx` (11), `lib/flowSchematic.test.ts` (3).

---

## Земляные работы (pad earthwork) — `padEarthwork/` и `lib/padEarthworkSketch/`

Публичный API модалки: `import { PadEarthworkSketchModal } from '../components/padEarthwork/PadEarthworkSketchModal'` — без изменений.

Потребители: `InfraPadEarthworkSection`, карта (режим «Площадки»), тесты `padEarthworkSketch.test.ts`, `infraPadEarthwork.test.ts`.

```
components/padEarthwork/
├── PadEarthworkSketchModal.tsx          # shell (~116): AppModal + tabs
├── usePadEarthworkSketchModal.ts        # orchestrator (state + preview + mutations)
├── usePadEarthworkSketchState.ts
├── usePadEarthworkSketchDemPreview.ts
├── usePadEarthworkSketchMutations.ts
├── padEarthworkSketchModalState.ts
├── PadEarthworkSketchPlanTab.tsx        # вкладка «План»
├── PadEarthworkSketchPlanToolbar.tsx
├── PadEarthworkSketchPlanSidebar.tsx
├── padEarthworkSketchPlanTabTypes.ts
├── PadEarthworkSketchScene3dTab.tsx
├── PadEarthworkScene3D.tsx
├── PlanRectangleEditor.tsx
├── PlanPolygonEditor.tsx                # shell (~48)
├── usePlanPolygonEditor.ts              # drag/tools/viewport hook (~350)
├── PlanPolygonEditorSvg.tsx             # SVG canvas (~250)
├── planPolygonEditorTypes.ts
└── … (Dem*, Envelope*, toolbars)

lib/padEarthworkSketch.ts                # barrel (export *)
lib/padEarthworkSketch/
├── types.ts, clamp.ts, rectangle.ts, polygon.ts
├── envelope.ts, layout.ts, api.ts, index.ts

objectDetailPanel/
├── InfraPadEarthworkSection.tsx         # shell (~130)
├── useInfraPadEarthworkSection.ts
├── InfraPadEarthworkSectionForm.tsx
└── infraPadEarthworkSectionUtils.ts
```

Тесты: `lib/padEarthworkSketch.test.ts` (30), `lib/infraPadEarthwork.test.ts`, `envelopeBerm*.test.ts`, `padEarthworkScene3d.test.ts`.

---

## `lib/` — доменные подпапки (июнь 2026)

Плоские файлы сгруппированы по доменам; **публичные импорты сохранены** через re-export stubs в корне `lib/`:

| Подпапка | Файлы (≈) | Stub-примеры |
|----------|-----------|--------------|
| [`lib/padClustering/`](../../decision-matrix/frontend/src/lib/padClustering/) | 28 | `padClusteringScene3d.ts` → `./padClustering/padClusteringScene3d` |
| [`lib/map2d/`](../../decision-matrix/frontend/src/lib/map2d/) | 33 | `mapClipboard.ts`, `mapUndo.ts`, `mapHitTest.ts` |
| [`lib/wellTrajectory/`](../../decision-matrix/frontend/src/lib/wellTrajectory/) | 12 | `wellTrajectoryProfile.ts`, `wellBottomholeProperties.ts` |
| [`lib/infra/`](../../decision-matrix/frontend/src/lib/infra/) | 13 | `infraGeometry.ts`, `infraPadEarthwork.ts` |

React вне чистой логики:

| Было | Стало | Stub |
|------|-------|------|
| `lib/flowSchematicContext.tsx` | `contexts/flowSchematicPropagationContext.tsx` | `lib/flowSchematicContext.tsx` |
| `lib/projectDisplay.tsx` | `lib/projectDisplay/index.tsx` | `lib/projectDisplay.tsx` |
| `lib/ieSubtypeIcons.tsx` | `components/infra/ieSubtypeIcons.tsx` | `lib/ieSubtypeIcons.tsx` |

Карта монорепо: [repo-layout.md](repo-layout.md).

---

## Куда смотреть при доработках

| Задача | Файлы |
|--------|-------|
| Новый UI / стили экрана | [ui-guidelines.md](ui-guidelines.md), `styles/features/<feature>.css`, `panelUi.tsx`, `AppSelect`, `AppModal` |
| Правка глобального CSS | `scripts/css-segments.mjs`, `styles/cascade-order.md`, `npm run verify:css` — не менять порядок `@import` без проверки |
| Новый инструмент на карте | `MapPageToolbar` draw group, `MapPage` drawMode state, `MapView` types |
| Поведение OL (click, drag) | `mapView/setupMapClickHandlers.ts`, `setupModifyHandlers.ts` |
| Синхронизация props → слои | `mapView/useMapViewDataSync.ts`, `useMapViewOverlays.ts` |
| Сохранение геометрии | `hooks/useMapGeometrySave.ts` |
| Карточка объекта | `objectDetailPanel/useObjectDetailPanel.ts` |
| Новый API endpoint | `lib/api/<domain>Api.ts` + тип в `entities.ts` / др.; compose в `apiClient.ts` (см. [module-boundaries.md](module-boundaries.md)) |
| Схема песка (логика) | `sandLogisticsFlow/layout.ts`, `sliceFlow.ts`, `siteLayout.ts` |
| Схема песка (UI) | `sandLogisticsFlowSchematic/SandLogisticsFlowCanvas.tsx`, `edgeComponents.tsx` |
| Песок: нормализация API | `sandLogisticsResult/normalize.ts`, `schematicSlice.ts` |
| Песок: prefs / warnings | `sandLogisticsResult/storagePrefs.ts`, `warnings.ts` |
| Схема потоков (PFD) | `flowSchematicEditor/FlowSchematicEditorInner.tsx`, `FlowEdge.tsx`, `FlowNode.tsx` |
| Земляные работы (модалка) | `padEarthwork/usePadEarthworkSketchModal.ts`, `PadEarthworkSketchPlanTab.tsx`, `lib/padEarthworkSketch/*` |
| Земляные работы (карточка) | `objectDetailPanel/useInfraPadEarthworkSection.ts`, `InfraPadEarthworkSectionForm.tsx` |
| Кластеризация кустов | `lib/padClustering/*`, `components/padClustering/` |
| 2D-карта (clipboard, undo) | `lib/map2d/*` |
| Траектории / bottomhole | `lib/wellTrajectory/*` |
| Инфра-геометрия | `lib/infra/*` |
| Тесты карты | `MapPage.*.test.tsx`, `MapView.smoke.test.tsx`, `mapPageHarness.tsx` |
| E2E клики по карте | `setupViewHandlers.ts` (`__dmOlMap` при `VITE_E2E_MAP_HOOK`), `e2e/helpers.ts` (`clickMapLonLat`) |

---

## Оставшиеся кандидаты на дробление

Основной план рефакторинга карты (июнь 2026) выполнен. `useMapPageMapActions.ts` разбит на `mapPageOrchestrator/actions/*` (фаза 3 ✅). **Pad earthwork:** `PadEarthworkSketchModal` (~1185→~116), `lib/padEarthworkSketch.ts` → `padEarthworkSketch/*`, `InfraPadEarthworkSection` → hook + form (compliance P2+ ✅). **CSS:** монолит `index.css` → `styles/` (35 файлов, каскад 1:1); карта — `features/map/` (фаза 2); модалка/flow — `components/app-modal/` (фаза 3). **Lint:** `npm run lint` — **0 errors, 0 warnings** (override `mapView/**` exhaustive-deps в `eslint.config.js`). **Данные:** `DataLayout` + `/data/*`; Import — `pages/import/*`, карточки через `ExportOptionCard`; Export — `pages/export/*`, `lib/projectExport/*`; Import 3D — `pages/import3d/*`. **Шапка:** `pageHeaderContext`, `resolvePageHeader`. `buildMapPageSections/` — split по секциям ✅. Backlog: прочие thin API handlers (`map_objects`, …). План — [solid-refactoring-plan.md](../planning/solid-refactoring-plan.md). Границы — [module-boundaries.md](module-boundaries.md).

