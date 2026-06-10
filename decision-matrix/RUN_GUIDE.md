# Гайд по запуску проекта

Этот документ описывает локальный запуск `decision-matrix` (backend + frontend).

## 1) Что нужно установить

- **Python** 3.11+ (рекомендуется 3.11/3.12)
- **Node.js** 20+ и **npm**
- (Опционально) **PostgreSQL + PostGIS**, если нужен полный гео-режим

Проверка версий:

```powershell
python --version
node --version
npm --version
```

## 2) Быстрый запуск (рекомендуется, SQLite)

Команды для **Windows PowerShell**. Корень репозитория: `C:\Users\user\Documents\Cursore` (рядом с `autoroad-network-planner/`).

### Шаг 1. Запуск backend (первый раз — venv и зависимости)

```powershell
cd C:\Users\user\Documents\Cursore\decision-matrix\backend
python -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install -r C:\Users\user\Documents\Cursore\decision-matrix\backend\requirements.txt
python -m pip install -e C:\Users\user\Documents\Cursore\autoroad-network-planner[steinerpy]
python C:\Users\user\Documents\Cursore\decision-matrix\backend\run_local.py
```

Проверка, что активен именно `venv`:

```powershell
python -c "import sys; print(sys.executable)"
python -m pip -V
```

Что делает `run_local.py`:
- создаёт/инициализирует SQLite БД `backend/data/sppr.db`
- выполняет сидирование демо-данными
- запускает API на `http://127.0.0.1:8000`

### Шаг 2. Запуск frontend (в новом терминале; `npm install` — только при первом запуске)

```powershell
cd C:\Users\user\Documents\Cursore\decision-matrix\frontend
npm install
npm run dev
```

Frontend будет доступен на `http://127.0.0.1:5173`.

**Журнал задач:** в шапке приложения (иконка слева от «Тема») — статусы расчётов и экспорт JSON запросов/ответов по **активному проекту** (`currentProjectId` в store). См. [docs/features/task-log-panel.md](../docs/features/task-log-panel.md).

**Экспорт данных:** раздел **«Экспорт»** (`/export`) — выбор проекта в панели на странице, количества объектов на карточках форматов, выгрузка координат и GeoJSON инфраструктуры. См. [docs/features/project-export.md](../docs/features/project-export.md).

## 3) Повторный запуск (со второго раза)

Если проект уже запускался ранее, обычно **не нужно** повторно:
- создавать venv (`python -m venv ...`)
- устанавливать backend-зависимости (`pip install -r ...`)
- устанавливать frontend-зависимости (`npm install`)

### Быстрые команды для повторного запуска (SQLite)

Backend:

```powershell
cd C:\Users\user\Documents\Cursore\decision-matrix\backend
.\venv\Scripts\Activate.ps1
python C:\Users\user\Documents\Cursore\decision-matrix\backend\run_local.py
```

Frontend (в отдельном терминале):

```powershell
cd C:\Users\user\Documents\Cursore\decision-matrix\frontend
npm run dev
```

Когда снова запускать установку зависимостей:
- после `git pull`, если изменились `requirements.txt` или `package.json`
- после удаления `venv` или `node_modules`
- при ошибках `ModuleNotFoundError` / `Cannot find module`

## 4) Доступы и полезные URL

### Демо-учётки (SQLite, после seed)

| Email | Пароль | Роль |
|-------|--------|------|
| `engineer@oilgas.ru` | `password123` | analyst |
| `admin@oilgas.ru` | `admin1234` | admin |
| `data@oilgas.ru` | `data12345` | data_manager |
| `viewer@oilgas.ru` | `viewer123` | viewer |

- Frontend: `http://127.0.0.1:5173` (или `:5174`, если 5173 занят)
- Backend API: `http://127.0.0.1:8000/api/v1`
- Swagger: `http://127.0.0.1:8000/api/v1/docs`
- Страницы: `/login`, `/register`, `/admin` (только admin)

Аутентификация через **httpOnly cookies** (не localStorage). Подробнее: [docs/architecture/auth-rbac.md](../docs/architecture/auth-rbac.md).

### Wiki для AI-помощника (фаза 10)

Исходники: [`docs/wiki/`](../docs/wiki/). После редактирования статей синхронизируйте bundle:

```powershell
python C:\Users\user\Documents\Cursore\scripts\sync-assistant-wiki.py
```

Проверка актуальности: `python scripts/sync-assistant-wiki.py --check`. Подробнее: [knowledge/README.md](backend/app/assistant/knowledge/README.md).

### AI-помощник и LLM (ошибки)

Настройка в `backend/.env` — см. [`.env.example`](backend/.env.example) (Ollama, LM Studio, OpenRouter). Wiki RAG embeddings — `ASSISTANT_WIKI_EMBEDDING_*` (можно отдельно от chat LLM).

- **Admin UI:** `/admin/assistant` — probe, override chat/embeddings, тест completion ([assistant-tools.md §8](../docs/features/assistant-tools.md)).
- `GET /api/v1/assistant/status` → `provider_ready: true` только если отвечает `GET …/models`.
- Если при отправке сообщения ошибка **OpenRouter 429** — исчерпан лимит бесплатной модели (`:free`); смените `ASSISTANT_LLM_MODEL` или подождите.
- Сообщения в панели помощника зависят от провайдера ([`frontend/src/lib/assistant/chatErrors.ts`](frontend/src/lib/assistant/chatErrors.ts)).

Подробнее: [chat/README.md](backend/app/assistant/chat/README.md), [assistant-tools.md §8–§10](../docs/features/assistant-tools.md).

### Пересоздание demo-пользователей

```powershell
cd C:\Users\user\Documents\Cursore\decision-matrix\backend
.\venv\Scripts\python.exe C:\Users\user\Documents\Cursore\decision-matrix\backend\seed.py
```

`seed.py` дополняет отсутствующих пользователей в SQLite (`data/sppr.db`).

## 5) Полный режим карты (PostgreSQL + PostGIS)

Используйте этот режим, если нужны пространственные функции PostGIS.

1. Установите PostgreSQL с расширением PostGIS.
2. Создайте БД и пользователя.
3. В `decision-matrix/backend` создайте `.env` на основе `.env.example`.
4. Укажите `DATABASE_URL`, например:

```env
DATABASE_URL=postgresql+asyncpg://sppr:sppr_secret@localhost:5432/sppr
SECRET_KEY=change-me-in-production
CORS_ORIGINS=http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173
```

> Для Postgres `seed.py` использует `DATABASE_URL` из `.env`. Для SQLite-dev используйте `run_local.py` + `seed.py` (override на SQLite внутри скрипта).

5. Запустите backend (первый раз — venv, зависимости, seed; затем API):

```powershell
cd C:\Users\user\Documents\Cursore\decision-matrix\backend
python -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install -r C:\Users\user\Documents\Cursore\decision-matrix\backend\requirements.txt
python -m pip install -e C:\Users\user\Documents\Cursore\autoroad-network-planner[steinerpy]
python C:\Users\user\Documents\Cursore\decision-matrix\backend\seed.py
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Повторный запуск (venv уже есть):

```powershell
cd C:\Users\user\Documents\Cursore\decision-matrix\backend
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

6. Frontend — как в §2 (повторный запуск):

```powershell
cd C:\Users\user\Documents\Cursore\decision-matrix\frontend
npm run dev
```

## 6) Если вы не на Windows

Для активации venv:

- macOS/Linux: `source venv/bin/activate`
- Windows PowerShell: `.\venv\Scripts\Activate.ps1`

Остальные команды те же; замените `C:\Users\user\Documents\Cursore` на путь к вашему клону репозитория.

## 7) Карта (поведение UI)

- **Расчётный граф** (узлы/рёбра `infrastructure_*`) **не рисуется на карте** — только объекты инфраструктуры, POI, линии анализа. Топология хранится в БД и используется в расчётах («Потоки», логистика песка). Подробнее: [map-objects-and-spatial-calculations.md](../docs/features/map-objects-and-spatial-calculations.md) §5–§6.
- **Горячие клавиши** (на странице карты, не в полях ввода): **E** — вкл/выкл «Редактирование на карте»; **Del** / **Backspace** — удалить выбранное; **Ctrl+Z** — отмена; **Enter** — завершить черновик линии; **Escape** — закрыть модал/поиск или выйти из рисования; в режиме **«Линия»** — **двойной ЛКМ** или **двойной ПКМ** завершить линию (в пустом месте создаётся узел `node`); в режиме **«Выбор»** + редактирование — **двойной ЛКМ** по **промежуточной** вершине удаляет её.
- **Рисование линии:** начало — клик по точечному объекту на карте (координаты совпадают); середина — свободно; конец — на объекте (точное совпадение) или авто-`node`. Координаты в БД — полные; в строке внизу карты — 3 знака.
- **Редактирование линий:** «Редактирование на карте» → «Выбор» → линия. Концы нельзя оставить без привязки к точечному объекту. Подсказки — в footer карты.
- **Поиск на карте:** по названию, подтипу, имени слоя и строковым свойствам объектов.
- **Удаление линий:** после удаления линейного объекта backend пересобирает топологию сети из оставшихся линий; при групповом удалении frontend вызывает `buildNetwork` один раз.
- **Два порта frontend** (`5173` и `5174`): это **разные** dev-серверы и разные origin в браузере (`localStorage` / `sessionStorage` не общие). Держите **один** `npm run dev`; если 5173 занят — остановите старый процесс. На странице карты в dev показывается предупреждение, если frontend открыт не на порту **5173**.
- **2.5D / 3D карта:** в `frontend/.env`: `VITE_MAP_3D_ENABLED=true` и `VITE_MAPTILER_KEY=<ключ MapTiler>`. Перезапустите `npm run dev`. На `/map` — **2D | 3D**; в слоях — спутник, **Рельеф (3D)**, **3D-модели** (glTF), фильтры подтипов. Рисование только в 2D. Точки: glTF + палитра слоя; линии: 3D-трубы **по прямым сегментам между вершинами** (как 2D), ЛЭП — пролёты проводов в плане как 2D. Документация: [docs/features/map-3d-features.md](../docs/features/map-3d-features.md), правила объектов: [map-objects-and-spatial-calculations.md](../docs/features/map-objects-and-spatial-calculations.md) §1.5.
- **Локальный dev и `VITE_BASE_PATH`:** для `npm run dev` задайте `VITE_BASE_PATH=/` (или не задавайте переменную), иначе Vite может собрать base `/Scaning/` и страница login не откроется на `http://localhost:5173/`.
- **Проверка перед релизом:**

  ```powershell
  cd C:\Users\user\Documents\Cursore\decision-matrix\frontend
  npm run test
  npm run build

  cd C:\Users\user\Documents\Cursore\decision-matrix\backend
  .\venv\Scripts\Activate.ps1
  pytest tests/ -q
  ```

  (кроме `test_demo_users` — нужна SQLite `data/sppr.db` с таблицами)

- **E2E (Playwright):** backend в одном терминале, тесты — в другом:

  ```powershell
  cd C:\Users\user\Documents\Cursore\decision-matrix\backend
  .\venv\Scripts\Activate.ps1
  python C:\Users\user\Documents\Cursore\decision-matrix\backend\run_local.py
  ```

  ```powershell
  cd C:\Users\user\Documents\Cursore\decision-matrix\frontend
  npm run test:e2e
  ```

  Vite для E2E — на `:5174`. После прогона данные чистятся автоматически. Ручная очистка:

  ```powershell
  cd C:\Users\user\Documents\Cursore\decision-matrix\backend
  .\venv\Scripts\python.exe C:\Users\user\Documents\Cursore\decision-matrix\backend\scripts\cleanup_e2e_data.py
  ```

- **Покрытие (опционально):**

  ```powershell
  cd C:\Users\user\Documents\Cursore\decision-matrix\frontend
  npm run test:coverage
  ```

  ```powershell
  cd C:\Users\user\Documents\Cursore\decision-matrix\backend
  .\venv\Scripts\Activate.ps1
  pytest tests/ --cov=app --cov-report=term-missing
  ```

  См. [docs/testing/testing-strategy.md](../docs/testing/testing-strategy.md).

- **Демо-сеть для проверки 3D:**

  ```powershell
  cd C:\Users\user\Documents\Cursore\decision-matrix\backend
  .\venv\Scripts\Activate.ps1
  python C:\Users\user\Documents\Cursore\decision-matrix\backend\scripts\draw_demo_map_network.py --project-name "третий проект"
  ```

  (или укажите имя вашего проекта)

## 8) Частые проблемы

- **Не входит admin / Invalid credentials**  
  Demo-пользователи могли не попасть в SQLite:

  ```powershell
  cd C:\Users\user\Documents\Cursore\decision-matrix\backend
  .\venv\Scripts\python.exe C:\Users\user\Documents\Cursore\decision-matrix\backend\seed.py
  ```

  Убедитесь, что backend запущен через `run_local.py` (SQLite), а не только через `.env` Postgres.

- **Request failed / 401 после входа**  
  Очистите cookies для `localhost`. Используйте frontend через Vite proxy (`http://localhost:5173`), не задавайте `VITE_API_URL` на прямой backend в dev.

- Порт `5173` или `8000` занят  
  Освободите порт или запустите сервис на другом порту. Добавьте новый порт frontend в `CORS_ORIGINS`. Не открывайте одновременно `localhost:5173` и `localhost:5174` — см. §7 «Карта».

- **«Сеть» / ModuleNotFoundError: network_planner**  
  Установите пакет планировщика и перезапустите backend:

  ```powershell
  cd C:\Users\user\Documents\Cursore\decision-matrix\backend
  .\venv\Scripts\Activate.ps1
  python -m pip install -e C:\Users\user\Documents\Cursore\autoroad-network-planner[steinerpy]
  python C:\Users\user\Documents\Cursore\decision-matrix\backend\run_local.py
  ```

- **«Построить сеть» / Not Found** или **Method Not Allowed** на `/admin/assistant/llm-config`  
  Часто на порту `8000` висит **старый** uvicorn (без новых маршрутов). Предпочтительно запускать **`run_local.py`** — он освобождает порт и при занятости `8000` пишет актуальный порт в `backend/.dev-port` (например `8001`). Vite proxy читает этот файл на каждый запрос; если frontend уже был запущен до смены порта — перезапустите `npm run dev`.

  ```powershell
  cd C:\Users\user\Documents\Cursore\decision-matrix\backend
  .\venv\Scripts\Activate.ps1
  python C:\Users\user\Documents\Cursore\decision-matrix\backend\run_local.py
  ```

  Проверка: в OpenAPI (`http://127.0.0.1:<port>/api/v1/openapi.json`) у `/api/v1/admin/assistant/llm-config` — `get`, `post`, `delete`; также `llm-probe` и `llm-test` (`post`), `llm-models` (`get`). На `/admin/assistant` (вкладка **Статус и настройка**) кнопка **Проверить подключение** и авто-probe при загрузке вызывают `POST /llm-probe`. Если probe возвращает 404 — перезапустите backend; UI может показать упрощённый статус из `llm-config`. UI открывайте на **5173**, не на `:8000`.

- `pip install` падает на зависимостях  

  ```powershell
  cd C:\Users\user\Documents\Cursore\decision-matrix\backend
  .\venv\Scripts\Activate.ps1
  python -m pip install --upgrade pip
  ```

- Frontend не видит API  
  Убедитесь, что backend запущен. Актуальный порт — в `decision-matrix/backend/.dev-port` (по умолчанию `8000`). Не задавайте `VITE_API_URL` в dev — используйте Vite proxy.

- Ошибка CORS  
  Проверьте `CORS_ORIGINS` в `backend/.env` — должен совпадать с URL frontend (включая порт).

- CSRF validation failed / «Обновите страницу» (в т.ч. upload GLB на проде)  
  Перелогиньтесь или обновите frontend: клиент синхронизирует Bearer/CSRF через `POST /auth/refresh`; при `Authorization: Bearer` CSRF не проверяется. См. [docs/architecture/auth-rbac.md](../docs/architecture/auth-rbac.md).

- Custom GLB не отображаются в 3D после загрузки (прод, 404 в Network)  
  На GitHub Pages файлы моделей запрашиваются с API с Bearer (`map3dCustomGlbFetch.ts`), не через cookie-only GLTFLoader. Ctrl+F5 (сброс кэша 404). См. [docs/features/map-3d-features.md](../docs/features/map-3d-features.md) § custom GLB.
