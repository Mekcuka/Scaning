# Autoroad network planner (standalone)

Копия модуля **автопостроения сети автодорог** из `decision-matrix`, без FastAPI и базы данных.  
Подходит для экспериментов в Jupyter, внешних интеграций и отдельного HTTP-сервиса.

| Документ | Содержание |
|----------|------------|
| [docs/autoroad-network-instruction.md](../docs/autoroad-network-instruction.md) | Пошаговая инструкция, UI, **внешний API**, `curl` |
| [docs/autoroad-network-plan.md](../docs/autoroad-network-plan.md) | Алгоритмы, предупреждения, таблицы случаев |

Исходники в приложении:

- `decision-matrix/backend/app/services/autoroad_network/` — планировщик + JSON-конвейер BFF
- `decision-matrix/services/autoroad-network/` — FastAPI `POST /v1/network/plan` (тот же контракт)

---

## JSON-контракт

Планировщик **stateless**: на входе — полное описание объектов в JSON, на выходе — план линий и узлов. Запись в БД (`apply`) есть только в decision-matrix.

| Шаг в UI / BFF | В этом пакете |
|----------------|---------------|
| `NetworkPlanRequest` | `NetworkPlanRequest` — см. таблицы ниже |
| `compute` | `plan_from_request(req)` или `compute_network_plan_sync(req)` |
| `NetworkPlanResponse` | тот же тип; `terminals[]` эхом повторяют вход + snap |
| `apply` | **нет** |

Схемы BFF (`AutoroadNetworkBuildRequestBody`, `AutoroadNetworkApplyBody`) продублированы в `autoroad_planner/schemas.py` для справки.

### `NetworkPlanRequest` (вход)

| Поле верхнего уровня | Тип | Описание |
|----------------------|-----|----------|
| `project_id` | UUID | Корреляция логов; планировщик **не читает** БД |
| `terminals` | массив | Точечные объекты для соединения (2–50) |
| `existing_autoroads` | массив | Уже нарисованные `autoroad` (полилинии) |
| `options` | объект | `snap_tolerance_km`, `node_dedup_km`, `max_terminals` |

**Терминал (`PlanTerminalInput`):**

| Поле | Обязательно | Описание |
|------|-------------|----------|
| `id` | да | UUID объекта |
| `subtype` | да | Подтип DM (`gas_processing`, `refinery`, …) |
| `name` | нет | Отображаемое имя |
| `lon`, `lat` | да | WGS84 |
| `coordinates` | нет | `[lon, lat]` — должны совпадать с `lon`/`lat` |
| `category` | нет | Категория слоя (`area_facility`, …) |
| `subtype_label` | нет | Подпись («ГКС», «НПЗ», …) |
| `properties` | нет | Произвольный JSON метаданных |

**Существующая дорога (`ExistingAutoroadInput`):**

| Поле | Описание |
|------|----------|
| `id` | UUID линии |
| `coordinates` | `[[lon, lat], ...]`, минимум 2 точки |
| `name`, `subtype` | Метаданные (обычно `subtype`: `autoroad`) |

Пример файла: [`data/example_request.json`](data/example_request.json).

### `NetworkPlanResponse` (выход)

| Поле | Описание |
|------|----------|
| `terminals[]` | Эхо входа: `name`, `subtype`, `coordinates`, `properties`, плюс `snap_lon`/`snap_lat`, `warning`, `graph_attached` |
| `new_lines[]` | `kind`: `connector` \| `link`, `coordinates`, опционально `snap_*_object_id` |
| `new_nodes[]` | `lon`, `lat`, `reason` |
| `preview` | GeoJSON FeatureCollection; в свойствах линий — `snap_start_name` / `snap_finish_name` |
| `request_meta` | `project_id`, `terminal_count`, `existing_road_count` |
| `warnings`, `total_new_km`, счётчики | Как в BFF |

---

## Способы вызова

| Способ | Как |
|--------|-----|
| **Python (этот пакет)** | `plan_from_request(req)` |
| **HTTP микросервис** | `POST http://<host>:8001/v1/network/plan` — см. `decision-matrix/services/autoroad-network/` |
| **BFF приложения** | `POST .../autoroad-network/compute` — тот же JSON + авторизация |

`project_id` может быть любым UUID для внешних систем.

---

## Установка

Отдельное venv в каталоге пакета:

```powershell
cd C:\Users\user\Documents\Cursore\autoroad-network-planner
python -m venv C:\Users\user\Documents\Cursore\autoroad-network-planner\venv
C:\Users\user\Documents\Cursore\autoroad-network-planner\venv\Scripts\Activate.ps1
python -m pip install -r C:\Users\user\Documents\Cursore\autoroad-network-planner\requirements.txt
python -m pip install -e C:\Users\user\Documents\Cursore\autoroad-network-planner
```

Или venv из decision-matrix:

```powershell
cd C:\Users\user\Documents\Cursore\decision-matrix\backend
C:\Users\user\Documents\Cursore\decision-matrix\backend\venv\Scripts\Activate.ps1
python -m pip install -e C:\Users\user\Documents\Cursore\autoroad-network-planner
```

---

## Быстрый запуск (Python)

Интерактивно или в скрипте (после активации venv и `pip install -e`):

```python
from uuid import UUID, uuid4
from autoroad_planner import plan_from_request, NetworkPlanRequest, PlanTerminalInput

terminals = [
    PlanTerminalInput(
        id=UUID("6e0a2599-f391-4ca2-be46-565b71657222"),
        subtype="gas_processing",
        subtype_label="ГКС",
        category="area_facility",
        name="GKS_1",
        lon=37.142939,
        lat=56.040613,
        coordinates=[37.142939, 56.040613],
        properties={},
    ),
    PlanTerminalInput(
        id=UUID("53c1e053-c2aa-4265-b972-2550efb98ef6"),
        subtype="gas_processing",
        subtype_label="ГКС",
        name="GKS_2",
        lon=37.209718,
        lat=56.040613,
    ),
]

req = NetworkPlanRequest(project_id=uuid4(), terminals=terminals, existing_autoroads=[])
out = plan_from_request(req)

print(out.request_meta)
print(out.total_new_km, out.warnings)
for tr in out.terminals:
    print(tr.name, tr.coordinates, tr.snap_lon, tr.warning)
```

План из `example_request.json` одной командой:

```powershell
cd C:\Users\user\Documents\Cursore\autoroad-network-planner
C:\Users\user\Documents\Cursore\autoroad-network-planner\venv\Scripts\Activate.ps1
python -c "import json; from pathlib import Path; from uuid import uuid4; from autoroad_planner import plan_from_request, NetworkPlanRequest; p=Path(r'C:\Users\user\Documents\Cursore\autoroad-network-planner\data\example_request.json'); raw=json.loads(p.read_text(encoding='utf-8')); req=NetworkPlanRequest.model_validate(raw); out=plan_from_request(req); Path(r'C:\Users\user\Documents\Cursore\autoroad-network-planner\data\out_plan.json').write_text(out.model_dump_json(indent=2), encoding='utf-8'); print(out.total_new_km, out.warnings)"
```

Сохранение request/response в `data/`:

```python
from pathlib import Path

ROOT = Path(r"C:\Users\user\Documents\Cursore\autoroad-network-planner")

(ROOT / "data" / "out_plan.json").write_text(
    out.model_dump_json(indent=2),
    encoding="utf-8",
)
(ROOT / "data" / "in_request.json").write_text(
    req.model_dump_json(indent=2),
    encoding="utf-8",
)
```

Проверка регрессии 12 ГКС (тесты decision-matrix):

```powershell
cd C:\Users\user\Documents\Cursore\decision-matrix\backend
C:\Users\user\Documents\Cursore\decision-matrix\backend\venv\Scripts\Activate.ps1
python -m pytest C:\Users\user\Documents\Cursore\decision-matrix\backend\tests\test_autoroad_network_plan.py::test_gks_twelve_layout_connected -q
```

Полный набор тестов планировщика:

```powershell
cd C:\Users\user\Documents\Cursore\decision-matrix\backend
C:\Users\user\Documents\Cursore\decision-matrix\backend\venv\Scripts\Activate.ps1
python -m pytest C:\Users\user\Documents\Cursore\decision-matrix\backend\tests\test_autoroad_network_plan.py -q --noconftest -k "not integration and not full_rebuild"
```

---

## Jupyter Lab

```powershell
cd C:\Users\user\Documents\Cursore\autoroad-network-planner
C:\Users\user\Documents\Cursore\autoroad-network-planner\venv\Scripts\Activate.ps1
python -m pip install jupyterlab ipykernel matplotlib
python -m ipykernel install --user --name autoroad-planner --display-name "autoroad-planner"
jupyter lab --notebook-dir=C:\Users\user\Documents\Cursore\autoroad-network-planner
```

Откройте `C:\Users\user\Documents\Cursore\autoroad-network-planner\notebooks\autoroad_network_preview.ipynb`.  
В ноутбуке выберите ядро **autoroad-planner**.

---

## Структура

```text
C:\Users\user\Documents\Cursore\autoroad-network-planner\
  autoroad_planner\
    plan_core.py
    schemas.py
    client.py
    terminal_exclusion.py
    road_graph.py
    graph_from_polylines.py
    ...
  data\
    example_request.json
    gks12_request.json
  notebooks\
    autoroad_network_preview.ipynb
```

---

## HTTP (микросервис)

Запуск сервиса (отдельный терминал, если нужен порт 8001):

```powershell
cd C:\Users\user\Documents\Cursore\decision-matrix\services\autoroad-network
# см. README сервиса: uvicorn / docker
```

Запрос плана (PowerShell, `curl.exe`):

```powershell
curl.exe -s -X POST "http://127.0.0.1:8001/v1/network/plan" `
  -H "Content-Type: application/json" `
  -d "@C:\Users\user\Documents\Cursore\autoroad-network-planner\data\example_request.json"
```

Сервис без API key по умолчанию — не публикуйте в интернет без прокси.
