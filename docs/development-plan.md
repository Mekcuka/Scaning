# План разработки

> **Статус (май 2026):** ядро MVP в `decision-matrix/` реализовано. Актуальная сводка «док ↔ код» — [implementation-status.md](./implementation-status.md).  
> **Дорожная карта после MVP:** [system-evolution-plan.md](./system-evolution-plan.md) (горизонты H0–H5, метрики, приоритеты).  
> Чеклисты ниже — **исторический план**; отмечены выполненные пункты по факту.

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
- Рабочее окружение для разработки
- Автоматические проверки кода при коммите
- Локальный запуск backend + frontend (см. `decision-matrix/README.md`)

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

> **Стек:** FastAPI + SQLAlchemy + Alembic (см. [README.md](./README.md)). Спецификация расчётов: [calculation-functions.md](./calculation-functions.md).

### Неделя 2: Настройка FastAPI и Auth
- [x] Инициализация FastAPI (`app/main.py`)
- [x] Настройка SQLAlchemy 2.0 + Alembic
- [x] Создание миграций (users, refresh_tokens; роль — колонка `users.role`)
- [x] Реализация регистрации и входа
- [x] JWT аутентификация (access + refresh tokens, httpOnly cookies)
- [x] Guards и Decorators (`require_roles`, `project_access`)
- [x] Unit-тесты auth сервиса (`tests/test_auth_rbac.py`)

> Детали реализации: [auth-rbac.md](./auth-rbac.md)

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
- Работающий API для аутентификации
- API для работы с картой и геоданными
- Импорт данных
- Покрытие тестами > 70%

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
- [x] **3D-режим** (post-plan, [map-3d-features.md](./map-3d-features.md))

### Результат
- Работающий UI для аутентификации
- Интерактивная карта с импортом данных
- Dashboard

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
- **Инфраструктура проекта**: 9 подтипов, анализ окружения, базовый расчёт по POI
- **Инфраструктурная матрица**: вертикальная таблица + карточный вид
- **Одностраничник**: PDF + PPTX для руководства

---

## Этап 5: Визуализация и отчёты (Недели 12-13)

### Неделя 12: Отчёты и экспорт
- [x] Линии/статусы на карте по выбранной POI
- [x] PDF отчёта (клиентский print; server PDF — post-MVP)
- [x] Excel: таблицы экрана «Параметры» (`exportExcel.ts`)
- [ ] Полный экспорт матрицы/отчёта в Excel, экспорт GeoJSON проекта

### Результат
- Визуализация результатов матрицы по POI
- Одностраничники (PDF/PPTX) по выбранной точке интереса
- Экспорт отчётов

---

## Этап 6: Интеграция и тестирование (Неделя 13)

### Задачи
- [x] Integration API (pytest TestClient, ~140 тестов)
- [x] E2E тесты (Playwright, 6 сценариев)
- [ ] Тестирование производительности
  - [ ] Карта с 1000+ объектов
  - [ ] Матрица 50×20
- [ ] Тестирование безопасности
  - [ ] SQL injection
  - [ ] XSS
  - [x] Rate limiting (slowapi + tests)
- [ ] Исправление багов

### Результат
- Стабильное MVP
- Покрытие тестами > 80% backend, > 60% frontend
- Документация API (Swagger)

---

## Этап 7: Деплой и запуск (Неделя 14)

### Задачи
- [x] Документация деплоя ([DEPLOY.md](../DEPLOY.md))
- [x] Деплой frontend (GitHub Pages + workflow)
- [x] Деплой backend (Yandex VM workflow — опционально)
- [ ] Настройка PostgreSQL (Neon / Supabase)
- [ ] Настройка домена и SSL
- [ ] Настройка логирования (Winston)
- [ ] Smoke тесты на production

### Результат
- Работающее приложение в production
- Базовый мониторинг (health checks, логи)

---

## Метрики успеха MVP

- [x] Регистрация и вход работают
- [ ] Карта отображается с 1000+ объектов
- [ ] Создание матрицы от начала до результатов < 10 минут
- [ ] Расчёт матрицы 20×50 < 5 секунд
- [ ] Экспорт PDF отчёта < 10 секунд
- [x] Основные API покрыты integration/unit (см. [testing-strategy.md](./testing-strategy.md))
- [ ] Lighthouse score > 80 (Performance, Accessibility)
- [ ] 0 критических багов

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
