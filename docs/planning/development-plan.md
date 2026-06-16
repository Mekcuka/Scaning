# План разработки

> **Статус (июнь 2026):** ядро MVP в `decision-matrix/` **реализовано (~85% Must Have FR)**. Актуальная сводка «док ↔ код» — [implementation-status.md](implementation-status.md).  
> **Дорожная карта после MVP:** [system-evolution-plan.md](system-evolution-plan.md) (горизонты H0–H5, метрики, приоритеты).  
> **SOLID-рефакторинг:** [solid-refactoring-plan.md](solid-refactoring-plan.md), границы модулей — [module-boundaries.md](../architecture/module-boundaries.md).  
> Чеклисты ниже — **исторический план**; `[x]` — выполнено по факту, `[ ]` — не сделано или post-MVP.

## Сводка выполнения

| Этап | Статус | Примечание |
|------|--------|------------|
| 1. Подготовка | **5/6** | Husky/lint-staged в корне — нет |
| 2. Backend — ядро | **✅ готово** | auth, карта, импорт, async jobs |
| 3. Frontend — ядро | **11/12** | i18n — только русский UI |
| 4. Матрица + инфраструктура | **✅ готово** | 9 строк, one-pager PDF/PPTX |
| 5. Визуализация и отчёты | **4/4** | Excel параметров; экспорт GeoJSON/координат на `/data/export` |
| 6. Интеграция и тестирование | **частично** | unit + E2E + rate limit; perf/security — не формализованы |
| 7. Деплой | **5/7** | Pages + VM + PG (Docker) + SSL + smoke; Winston/ELK — нет |
| Метрики успеха MVP | **3/8** | см. § внизу |
| Сверх плана (post-plan) | **✅** | PFD, песок, autoroad, Искра, 3D, admin jobs |

## Общая оценка: 14-18 недель (MVP)

## Этап 1: Подготовка (Неделя 1)

### Задачи
- [x] Инициализация репозитория (frontend + backend в `decision-matrix/`)
- [x] Настройка ESLint, Prettier, TypeScript (frontend)
- [ ] Настройка Git hooks (Husky + lint-staged) — не в корне
- [x] Настройка CI/CD (GitHub Actions — `.github/workflows/ci.yml`)
- [x] Создание базовой структуры директорий
- [x] Локальная настройка БД (SQLite / PostgreSQL + PostGIS)

### Результат
- [x] Рабочее окружение для разработки
- [x] Автоматические проверки в CI (GitHub Actions)
- [ ] Git hooks при коммите (Husky) — не настроены
- [x] Локальный запуск backend + frontend (см. `decision-matrix/README.md`)

### Артефакты
```
├── .github/workflows/ci.yml
├── .eslintrc.js
├── .prettierrc
├── tsconfig.json
└── package.json (root)
```

---

## Этап 2: Backend — ядро (Недели 2-4)

> **Стек:** FastAPI + SQLAlchemy + Alembic (см. [README.md](../README.md)). Спецификация расчётов: [calculation-functions.md](../calculations/calculation-functions.md).

### Неделя 2: Настройка FastAPI и Auth
- [x] Инициализация FastAPI (`app/main.py`)
- [x] Настройка SQLAlchemy 2.0 + Alembic
- [x] Создание миграций (users, refresh_tokens; роль — колонка `users.role`)
- [x] Реализация регистрации и входа
- [x] JWT аутентификация (access + refresh tokens, httpOnly cookies)
- [x] Guards и Decorators (`require_roles`, `project_access`)
- [x] Unit-тесты auth сервиса (`tests/test_auth_rbac.py`)

> Детали реализации: [auth-rbac.md](../architecture/auth-rbac.md)

### Неделя 3: Map Module (часть 1)
- [x] Модели: infrastructure_layers, infrastructure_objects
- [x] CRUD для слоёв
- [x] CRUD для геообъектов
- [x] Интеграция PostGIS (geometry тип; SQLite fallback)
- [x] Пространственные запросы (geodesic, nearest)
- [x] Валидация GeoJSON / subtype ↔ geometry

### Неделя 4: Map Module (часть 2) — Импорт данных
- [x] Импорт GeoJSON + CSV (MVP)
- [x] Импорт Shapefile/KML
- [x] Базовый коннектор к API + `import_connections` (FR-2.5.9)
- [x] Асинхронные задачи (`schedule_async_import`, asyncio — не BullMQ/Celery)
- [x] Логи импорта

### Результат
- [x] Работающий API для аутентификации
- [x] API для работы с картой и геоданными
- [x] Импорт данных (CSV, GeoJSON, KML, Shapefile, Spark, API connections)
- [x] Покрытие тестами > 70% (`app/` ~72%)

---

## Этап 3: Frontend — ядро (Недели 5-8)

### Неделя 5: Настройка React + Vite и Layout
- [x] Инициализация React 19 + Vite
- [x] Настройка Tailwind CSS
- [x] Настройка TanStack Query
- [x] Создание layout (sidebar, header)
- [x] Настройка роутинга (React Router)
- [x] Тёмная/светлая тема
- [ ] Интернационализация (i18n)

### Неделя 6: Auth UI + Dashboard
- [x] Страницы входа и регистрации
- [x] Формы с валидацией (React Hook Form + Zod)
- [x] Хранение токенов (httpOnly cookie)
- [x] Защищённые роуты (+ RoleProtectedRoute, admin)
- [x] Dashboard страница
- [ ] Список матриц (таблица)
- [ ] Быстрые действия

### Неделя 7: Карта (часть 1)
- [x] Интеграция **OpenLayers** (`decision-matrix/frontend`)
- [x] Подложка спутник (Esri); OSM-переключатель 2D — нет; 3D + рельеф — см. map-3d-features
- [x] Отображение геообъектов (точки, линии; polygon MVP не поддерживается)
- [x] Управление слоями (вкл/выкл, группы подтипов)
- [x] Карточка / popup объекта
- [x] Поиск по объектам

### Неделя 8: Карта (часть 2) + Импорт UI
- [x] Инструменты рисования (точка, линия)
- [x] Пороговые круги вокруг POI
- [x] **Страница «Импорт»** (отдельный маршрут): API + файлы + история
- [x] Координаты курсора, линии по выбранной POI
- [x] **3D-режим** (post-plan, [map-3d-features.md](../features/map/map-3d-features.md))

### Результат
- [x] Работающий UI для аутентификации
- [x] Интерактивная карта с импортом данных (2D + 3D)
- [x] Dashboard
- [ ] Список матриц и быстрые действия на дашборде — не реализованы

---

## Этап 4: Матрица решений + Инфраструктура проекта (Недели 9-12)

### Неделя 9: Backend — Infrastructure variants
- [x] **Модели**: projects, POI, layers, objects, `poi_infrastructure_analysis` (live-анализ; `implementation_variants` — legacy в БД)
- [x] **9 строк анализа матрицы** + расширенные подтипы на карте (см. map-objects §1.4)
- [x] **API анализа окружения**: nearest external + internal formula
- [x] **API расчёта стоимости**: ставки + engineering equipment

### Неделя 10: Frontend — Matrix UI + Infrastructure
- [x] **Вертикальная таблица**: строки = параметры, столбцы = POI
- [x] **Группы бейджей** инженерных параметров
- [x] Фильтр превышений; мини-карта 2D/3D
- [x] **Ставки**: `/parameters/rates` (16 показателей)
- [x] **Матрица**: таблица + карточный вид
- [x] POI / пороги: карточка проекта + карта + матрица
- [x] Override объектов / construction_required (analysis PATCH)

### Неделя 11: Frontend — Matrix + One-pager
- [x] **Базовый расчёт** по POI (`analyze`, persist)
- [x] **Сравнение POI** в матрице
- [x] **Одностраничник**: редактор + список
- [x] **Экспорт PDF**: `window.print()` + print CSS
- [x] **Экспорт PPTX**: backend `python-pptx`
- [x] **Дорожная карта** в шаблоне отчёта

### Результат
- [x] **Инфраструктура проекта**: 9 строк анализа, расширенные подтипы на карте, анализ окружения, расчёт по POI
- [x] **Инфраструктурная матрица**: вертикальная таблица + карточный вид
- [x] **Одностраничник**: PDF (`window.print`) + PPTX (`python-pptx`)

---

## Этап 5: Визуализация и отчёты (Недели 12-13)

### Неделя 12: Отчёты и экспорт
- [x] Линии/статусы на карте по выбранной POI
- [x] PDF отчёта (клиентский print; server PDF — post-MVP)
- [x] Excel: таблицы экрана «Параметры» (`exportExcel.ts`)
- [x] **Экспорт GeoJSON и координат проекта** — `/data/export`, клиент (`lib/projectExport/`, [project-export.md](../features/import-export/project-export.md))
- [ ] Полный экспорт матрицы/отчёта в Excel

### Результат
- [x] Визуализация результатов матрицы по POI (линии/статусы на карте)
- [x] Одностраничники (PDF/PPTX) по выбранной точке интереса
- [x] Экспорт Excel таблиц экрана «Параметры»
- [ ] Полный экспорт матрицы/отчёта в Excel

---

## Этап 6: Интеграция и тестирование (Неделя 13)

### Задачи
- [x] Integration API (pytest TestClient, ~140 тестов)
- [x] E2E тесты (Playwright, 12 сценариев: auth, проекты, карта, потоки/логистика, импорт, параметры; автоочистка `cleanup_e2e_data.py`)
- [ ] Тестирование производительности
  - [ ] Карта с 1000+ объектов
  - [ ] Матрица 50×20
- [ ] Тестирование безопасности
  - [ ] SQL injection
  - [ ] XSS
  - [x] Rate limiting (slowapi + tests)
- [ ] Исправление багов

### Результат
- [x] Стабильное MVP (prod: GitHub Pages + VM)
- [x] Покрытие frontend `pages/` ~79% (> 60%)
- [ ] Покрытие backend > 80% (факт ~72%)
- [x] Документация API (Swagger `/api/v1/docs`)

---

## Этап 7: Деплой и запуск (Неделя 14)

### Задачи
- [x] Документация деплоя ([DEPLOY.md](../../DEPLOY.md))
- [x] Деплой frontend (GitHub Pages + workflow)
- [x] Деплой backend (Yandex VM workflow)
- [x] PostgreSQL + PostGIS (Docker на VM; managed Neon/Supabase — не используется)
- [x] Домен и SSL (`erascaning.duckdns.org`, Caddy)
- [ ] Централизованное логирование (Winston / ELK) — только stdout на VM
- [x] Smoke-тесты на production (`/health` в deploy workflow)

### Результат
- [x] Работающее приложение в production (Pages + API на VM)
- [x] Базовый мониторинг (health checks, Redis/worker при `REDIS_URL`)

---

## Метрики успеха MVP

- [x] Регистрация и вход работают
- [ ] Карта с 1000+ объектов без деградации (есть bbox/LOD оптимизации, формальный бенчмарк — нет)
- [ ] Создание матрицы от начала до результатов < 10 минут (не замерялось)
- [ ] Расчёт матрицы 20×50 < 5 секунд (не замерялось)
- [x] Экспорт PDF отчёта < 10 секунд (клиентский `window.print`)
- [x] Основные API покрыты integration/unit (см. [testing-strategy.md](../testing/testing-strategy.md))
- [ ] Lighthouse score > 80 (Performance, Accessibility)
- [ ] 0 критических багов (ongoing)

---

## Дополнительно реализовано (сверх исходного плана)

> Не входило в этапы 1–7, но **готово** в коде (июнь 2026).

- [x] **Схема потоков (PFD)** — `/flows/*`, React Flow, маршруты по сети ([fluid-flow-schematic.md](../features/flows/fluid-flow-schematic.md))
- [x] **Экономическая схема потоков** — вкладка «Потоки → Экономика»
- [x] **Логистика песка** — `/flows/logistics`, timeline, analyze API
- [x] **Автосеть автодорог** — Steiner tree, UI «Сеть», BFF plan/apply ([autoroad-network-plan.md](../autoroad/autoroad-network-plan.md))
- [x] **Импорт Искра** — `spark_import.py` ([spark-import-mapping.md](../features/import-export/spark-import-mapping.md))
- [x] **Импорт 3D** — custom GLB, `/data/import-3d` ([map-3d-features.md](../features/map/map-3d-features.md))
- [x] **Журнал задач** — панель в шапке + `/admin/jobs` ([task-log-panel.md](../features/jobs/task-log-panel.md))
- [x] **Экспорт проекта** — `/data/export` ([project-export.md](../features/import-export/project-export.md))
- [x] **Импорт (карточки)** — `/data/import` ([project-import.md](../features/import-export/project-import.md))
- [x] **Админка пользователей** — `/admin/users`, RBAC, stats
- [x] **Граф сети** — build/list nodes/edges (для расчётов, не на карте)

---

## Следующие версии (после MVP)

### v1.1 — Улучшения
- [ ] Совместная работа (sharing матриц)

### v1.2 — Интеграции
- [ ] Подключение внешних API (OpenStreetMap, GeoNames)
- [ ] Автоматическая синхронизация данных
- [ ] WebSocket для real-time обновлений

### v1.3 — Аналитика
- [ ] ML-прогнозирование
- [ ] Расширенная статистика
- [ ] Публичные шаблоны матриц

### v2.0 — Enterprise
- [ ] SSO / LDAP интеграция
- [ ] Аудит действий
- [ ] SLA и приоритетная поддержка

---

## Трек SOLID-рефакторинга (после MVP, июнь 2026)

План: [solid-refactoring-plan.md](solid-refactoring-plan.md). Границы: [module-boundaries.md](../architecture/module-boundaries.md).

| Фаза | Задача | Статус |
|------|--------|--------|
| 0 | Границы модулей, чеклист PR | **✅ документация** |
| 1 | Разбить `apiClient.ts` на `*Api.ts` | **✅** |
| 2 | Декомпозиция `infrastructure_analysis.py` | **✅** |
| 3 | `useMapPageMapActions`, Import-страницы | **✅** |
| 4 | DIP: planner, spatial, api slices | **✅** |
| 5 | OCP: реестры subtypes / matrix rows | **✅** |
| 6 | Вынести projects из `router.py` | [x] |
