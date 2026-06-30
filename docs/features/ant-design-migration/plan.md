# План: миграция UI на Ant Design 6

**Дата:** 2026-06-30  
**Статус:** integrated (B1–B15, 2026-06-30)

## Цель и границы

### В scope

- App shell (`AppLayout`, subnav layouts)
- UI-примитивы: `AppModal`, `AppSelect`, `ToastStack`, `PageSkeleton`, `DeferredNumberInput`, `panelUi`
- Страницы CRUD: Login/Register, Projects, Dashboard, Admin, Parameters, Data, Reports, Matrix
- Панели chrome: `TaskLogPanel`, `ObjectDetailPanel` (формы), `AssistantPanel` (оболочка)
- Тема: `ConfigProvider` + маппинг `tokens.css` → Ant Design Token

### Вне scope

- Карта 2D/3D (OpenLayers, Three.js), React Flow, SVG/3D-редакторы
- Recharts, xlsx, цвета подтипов карты
- Backend

## Стек

| Компонент | Выбор |
|-----------|-------|
| UI library | **antd@6**, **@ant-design/icons** |
| Locale | `ru_RU` |
| Тема | `ConfigProvider` + `theme.darkAlgorithm` / `defaultAlgorithm` |
| Формы | Ant `Form` + react-hook-form на auth-страницах |
| Стратегия | Адаптеры примитивов → shell → страницы → CSS cleanup |

## Фазы Builder

1. **B1** — Foundation: `AntThemeProvider`, зависимости
2. **B2** — Shell: `AppLayout`, subnav layouts
3. **B3** — Примитивы-адаптеры
4. **B4** — Auth + простые страницы
5. **B5** — Parameters, Data, Reports, Matrix
6. **B6** — Map panels (гибрид)
7. **B7** — Оставшиеся компоненты
8. **B8** — CSS cleanup

## Критерии готовности (Reviewer)

- [ ] Контракт из `contract.md` реализован для адаптеров и shell
- [ ] `npm run lint`, `npm run test`, `npm run test:coverage` зелёные
- [ ] Canvas-зоны (карта, flow, 3D) без регрессий
- [ ] Light/dark theme через `useAppStore` + ConfigProvider
- [ ] E2E обновлены при смене селекторов

## Риски

| Риск | Митигация |
|------|-----------|
| E2E на `.btn` | `data-testid`, role-based селекторы |
| z-index модалок vs карта | `zIndexPopupBase` в theme |
| Bundle size | Импорт компонентов по отдельности |
