# UI guidelines — Atlas Grid (frontend)

> Единый гайд по визуальной части при новых экранах и правках UI.  
> Код стилей: [`decision-matrix/frontend/src/styles/`](../../decision-matrix/frontend/src/styles/) (точка входа — [`index.css`](../../decision-matrix/frontend/src/index.css)).  
> Структура компонентов: [frontend-structure.md](frontend-structure.md).

---

## 1. Принципы

- **Инженерное desktop-приложение** — плотная информация, не маркетинговый лендинг.
- **Язык UI** — русский (подписи, кнопки, подсказки).
- **Шрифт** — Inter, system-ui (`body` в `styles/base.css`).
- **Иконки** — [Lucide](https://lucide.dev); в панелях и вкладках обычно **15–20px**, `strokeWidth={1.5}` или `2`.
- **Тема** — светлая по умолчанию; тёмная через `[data-theme="dark"]` на корне. Цвета задаются **CSS-переменными**, не дублируются в компонентах.

---

## 2. Design tokens

Определены в `:root` и переопределяются в `[data-theme="dark"]` ([`styles/tokens.css`](../../decision-matrix/frontend/src/styles/tokens.css)).

| Переменная | Назначение |
|------------|------------|
| `--bg` | Фон приложения |
| `--surface`, `--surface-2`, `--surface-3` | Карточки, панели, заголовки |
| `--border` | Рамки полей и карточек |
| `--text`, `--text-muted` | Основной и вторичный текст |
| `--primary`, `--primary-hover` | Основные действия (кнопки, focus) |
| `--accent` | Акцент (редко; не путать с primary) |
| `--success`, `--success-bg`, `--warning`, `--warning-bg` | Статусы, алерты |
| `--shadow`, `--shadow-lg` | Тени карточек и модалок |
| `--radius` | Скругление карточек (10px) |
| `--sidebar-bg`, `--sidebar-text` | Боковое меню |

**Правило:** в новых стилях использовать `var(--*)`. Сырые hex допустимы только для **карты** (цвета подтипов в [`mapIcons.ts`](../../decision-matrix/frontend/src/lib/mapIcons.ts)) и legacy badge-ов.

---

## 3. Layout приложения

### Shell

- `#root`, `.app-viewport`, `.app-shell`, `.app-content` — цепочка **без scroll на `body`**; контент скроллится внутри областей.
- Не ломать `overflow: hidden` на shell без проверки карты и длинных форм.

### Страница

| Класс | Назначение |
|-------|------------|
| `.app-header-page` | Заголовок текущей страницы в **глобальной шапке** (`PageHeaderOutlet`) |
| `.app-header-page__title` | H1 заголовок раздела |
| `.app-header-page__subtitle` | Подзаголовок под title в шапке |
| `.page-header` | Локальная шапка в теле страницы (legacy; новые экраны — `usePageHeader`) |
| `.page-title` / `h1` в header | Заголовок |
| `.subtitle` / `.page-subtitle` | Подзаголовок, lead-текст |

**Паттерн (июнь 2026):** страница вызывает `usePageHeader({ title, subtitle })`; статические маршруты — `resolvePageHeader(pathname)`. Действия (кнопки, переключатели режима) — **в контенте страницы**, не в `app-header`.

Примеры: [`AppLayout.tsx`](../../decision-matrix/frontend/src/components/layout/AppLayout.tsx), [`ImportPage.tsx`](../../decision-matrix/frontend/src/pages/ImportPage.tsx), [`ExportPage.tsx`](../../decision-matrix/frontend/src/pages/ExportPage.tsx).

### Блоки контента

| Класс | Назначение |
|-------|------------|
| `.card` | Белая/тёмная карточка с рамкой и тенью |
| `.card--flush` | Карточка без внутренних отступов (таблицы, панели) |
| `.card-header` | Заголовок карточки на `--surface-2` |

Фичевые обёртки (по аналогии): `.import-3d-panel`, `.parameters-layout__*`.

---

## 4. Примитивы (переиспользовать)

### Кнопки

```html
<button type="button" class="btn btn-primary">Сохранить</button>
<button type="button" class="btn btn-secondary">Отмена</button>
<button type="button" class="btn btn-ghost btn-sm">…</button>
```

Классы: `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-sm`.  
Иконка + текст: `gap` уже в `.btn`; Lucide с `size={16}`.

### Поля ввода

- Обёртка: `.form-group` + `<label>` (стили label внутри form-group).
- Поля: нативный `input` / `select` / `textarea` внутри `.form-group`, либо класс `.input`.
- Focus/hover — единые для всех полей (не переопределять без нужды).

### Селект

Компонент [`AppSelect`](../../decision-matrix/frontend/src/components/AppSelect.tsx), классы `.app-select-*`.  
Не собирать кастомный dropdown для стандартных списков.

### Модальные окна

Компонент [`AppModal`](../../decision-matrix/frontend/src/components/AppModal.tsx): пропсы `title`, `subtitle`, размеры `sm` / `md` / `lg`.  
Стили: `.app-modal-overlay`, `.app-modal-panel`, `.app-modal-header`, `.app-modal-body`, `.app-modal-footer`.

### Бейджи и числа

- Статусы: `.badge`, `.badge-success`, `.badge-warning`, `.badge-danger`, `.badge-muted`.
- Табличные числа: класс `.tabular` (`font-variant-numeric: tabular-nums`).

### Подсказки и muted-текст

- `.import-3d-muted`, `.object-detail-panel__hint` — вторичный текст в фичах.
- Для новых экранов: префикс фичи + `-muted` / `-hint`, цвет `var(--text-muted)`.

---

## 5. Панель объекта (эталон форм)

Для плотных форм с секциями, вкладками и pair-grid используйте обёртки из [`panelUi.tsx`](../../decision-matrix/frontend/src/components/objectDetailPanel/panelUi.tsx):

| Компонент | Когда |
|-----------|--------|
| `PanelSection` | Секция с заголовком (`card` для выделенного блока) |
| `PanelSubsection` | Подсекция с опциональным action |
| `FieldLabel` | Подпись поля + единица измерения |
| `PanelSwitch` | Toggle с label и description |
| `FluidToggle` | Переключатель «Нефть / Газ» |
| `ReadOnlyValue` | Только чтение с placeholder `—` |
| `StatChip` | Компактный чип со значением |
| `DetailPanelTabs` | Вкладки; `showLabels={false}` — только иконки |

### Pair-grid (label → control → hint)

Строка формы в панели объекта:

```html
<div class="object-detail-panel__pair-grid-row">
  <FieldLabel>…</FieldLabel>
  <control />
  <p class="object-detail-panel__field-hint">…</p>
</div>
```

Модификатор `--single` для одной колонки. Примеры: [`InfraDetailMainTab.tsx`](../../decision-matrix/frontend/src/components/objectDetailPanel/InfraDetailMainTab.tsx), [`InfraDetailExtraTab.tsx`](../../decision-matrix/frontend/src/components/objectDetailPanel/InfraDetailExtraTab.tsx).

Новые вкладки панели объекта — по тому же паттерну, не invent inline grid с нуля.

---

## 6. Именование CSS

- **Префикс фичи + BEM:** `import-3d-panel__title`, `object-detail-panel__tab--active`, `matrix-card`.
- **Элемент:** `__`; **модификатор:** `--` (например `--flush`, `--muted`, `--active`).
- **Не** добавлять глобальные селекторы без префикса (`div.card-inner` на весь проект).

### Где писать стили

| Тип | Файл |
|-----|------|
| Токены / тема | `src/styles/tokens.css` |
| Reset, body | `src/styles/base.css` |
| Shell | `src/styles/layout/` |
| Кнопки, формы | `src/styles/components/` |
| Модалка, flow overlays, toast | `src/styles/components/app-modal/` (см. `styles/README.md` § app-modal) |
| Экран / фича | `src/styles/features/<feature>.css` |
| Импорт / экспорт (карточки) | `export.css` — `.export-page`, `.export-grid`, `.export-option`, `.import-dropzone` |
| Карта 2D/3D | `src/styles/features/map/` — по префиксу класса (см. [`styles/README.md`](../../decision-matrix/frontend/src/styles/README.md) § map) |
| Глобальный responsive | `src/styles/responsive/` (порядок в `cascade-order.md`) |

Точка входа: [`index.css`](../../decision-matrix/frontend/src/index.css) — только `@import "tailwindcss"` и цепочка импортов (манифест: [`scripts/css-segments.mjs`](../../decision-matrix/frontend/scripts/css-segments.mjs)). Порядок: `tokens` → `base` → `components` → `features` → поздний `responsive`. См. [`styles/README.md`](../../decision-matrix/frontend/src/styles/README.md).

---

## 7. Tailwind 4

- Подключён глобально: `@import "tailwindcss"` в `index.css`.
- **Допустимо** в JSX для layout: `flex`, `gap-*`, `shrink-0`, `min-w-0`, `items-center`.
- **Не дублировать** кнопки, поля, карточки через utility-классы.
- **Не** массово использовать `@apply` в CSS — только для 1–2 повторяющихся миксинов, если появятся.

---

## 8. Специальные зоны

### Карта 2D / 3D

- Стили с префиксом `map-*`, `map-page-*`, `map-layers-*`.
- Не смешивать с админкой и параметрами.
- 3D: [map-3d-features.md](../features/map/map-3d-features.md).

### React Flow (потоки, логистика песка)

- Подписи на рёбрах и порталы — **только внутри канвы** React Flow.
- Не использовать `position: absolute` для подписей в prose страницы (см. комментарии в `styles/features/flow-schematic.css` и `styles/components/app-modal.css`).
- z-index порталов не менять без проверки наложения на edges.

### Цвета объектов на карте

Подтипы инфраструктуры — [`mapIcons.ts`](../../decision-matrix/frontend/src/lib/mapIcons.ts), не design tokens.

---

## 9. Доступность

- **Icon-only кнопки:** `aria-label` и/или `title` (см. Import3D, панель объекта).
- **Вкладки:** `role="tablist"`, `role="tab"`, `aria-selected` — как в `DetailPanelTabs`.
- **Переключатели:** `aria-pressed` на сегментных кнопках (`FluidToggle`).
- **Focus:** поля уже имеют видимый focus ring; не убирать `outline` без замены.
- **Контраст:** проверять критичный текст в **dark theme**.

---

## 10. Чеклист нового экрана

- [ ] Заголовок через `usePageHeader` (или статика в `resolvePageHeader`); subtitle при необходимости
- [ ] Кнопки действий — в теле страницы (toolbar / card actions), не в `app-header`
- [ ] Контент в `.card` или фичевой панели с тем же визуальным языком
- [ ] Кнопки через `.btn-*`; формы через `.form-group` / `AppSelect`
- [ ] Модалки через `AppModal`, не копипаста overlay
- [ ] CSS с префиксом фичи; цвета через `var(--*)`
- [ ] Smoke в light + dark theme
- [ ] `rg` по проекту — нет дублирующихся однотипных классов

---

## 11. Антипаттерны

- Inline `style={{ color, padding, background }}` для повторяемых паттернов
- Новые оттенки синего/серого «на глаз» вместо tokens
- Кастомная модалка с нуля вместо `AppModal`
- Кастомный select вместо `AppSelect`
- Глобальные селекторы, ломающие карту или панель объекта
- Изменение `.object-detail-panel__pair-grid` без проверки всех вкладок панели
- Tailwind-стилизация кнопок/инпутов, дублирующая `.btn` / `.form-group`

---

## 12. Связанные документы

| Документ | Содержание |
|----------|------------|
| [frontend-structure.md](frontend-structure.md) | Структура TSX, куда класть компоненты |
| [map-3d-features.md](../features/map/map-3d-features.md) | 3D-карта, custom GLB |
| [user-flows.md](../product/user-flows.md) | Пользовательские сценарии (Import 3D, карта) |
| [task-log-panel.md](../features/jobs/task-log-panel.md) | Стили журнала задач (`.task-log-*`) |

---

*При сомнении: найти похожий экран (Dashboard, Import 3D, панель объекта) и повторить его паттерн, а не изобретать новый.*
