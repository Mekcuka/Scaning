# Справочник реализации

Текущее поведение планировщика Steiner-сети после исправления связности GeoSteiner и общего пайплайна постобработки.

| Документ | Содержание |
|----------|------------|
| [IMPLEMENTATION.md](IMPLEMENTATION.md) | Эта же информация (EN) |
| [PARAMETERS.ru.md](PARAMETERS.ru.md) | Справочник параметров `options` |

---

## Архитектура

```
PlanRequest
    │
    ├─► LocalProjection (WGS84 → локальные метры)
    │
    ├─► Солвер (SteinerPy или GeoSteiner)
    │       └── SteinerTreeResult (terminals + steiner:*)
    │
    └─► Пайплайн постобработки (см. ниже)
            └── PlanResponse (рёбра в WGS84 + строки терминалов)
```

Оба endpoint используют одну схему запроса (`PlanRequest`) и большую часть шагов постобработки. Только GeoSteiner перед общими шагами вызывает `_ensure_tree_connected`.

---

## Солверы

### SteinerPy (`POST /v1/plan/steinerpy`)

- Строит **граф кандидатов**: терминалы, геометрический центроид, опциональные кольца примыкания, опциональные Steiner-точки GeoSteiner.
- Решает MIP задачи дерева Штейнера через **HiGHS** с помощью [SteinerPy](https://github.com/berendmarkhorst/SteinerPy).
- Всегда возвращает **одно связное** дерево на графе кандидатов.
- Поддерживает **лимиты примыкания**, **штраф за угол** и фильтрацию **steiner_radius** внутри графа кандидатов.

Если установлены бинарники GeoSteiner, SteinerPy автоматически добавляет Steiner-точки GeoSteiner как дополнительных кандидатов MIP (если `steiner_candidates` не передан явно).

### GeoSteiner (`POST /v1/plan/geosteiner`)

- Вызывает нативные `efst | bb` для **точного** сертификата евклидова дерева Штейнера.
- **Не** применяет нативно лимиты примыкания, нормализацию листьев, зоны исключения и предпочтения по углу.
- При **n ≥ ~11–13** терминалах сертификат иногда описывает **несколько несвязных FST-компонент** с корректными координатами Steiner-точек, но неверной глобальной топологией.

Обходные меры внутри сервиса:

1. **`_tree_from_certificate_edges`** — если терминал отсутствует в рёбрах сертификата, подключить его к ближайшему существующему узлу.
2. **`_ensure_tree_connected`** — если остаётся несколько компонент, перестроить топологию через SteinerPy, используя Steiner-точки GeoSteiner как кандидатов; запасной вариант — кратчайшие «мостовые» рёбра между компонентами.

---

## Пайплайн постобработки

Порядок шагов зафиксирован в `src/network_planner/plan/pipeline.py`.

### Только GeoSteiner

| Шаг | Функция | Назначение |
|-----|---------|------------|
| 1 | `solve_steiner_tree_geosteiner` | Точное SMT; внутри солвера может применяться `normalize_terminal_leaves` |
| 2 | `_ensure_tree_connected` | Принудительно одна компонента (предпочтительно пересборка через SteinerPy) |
| 3 | `_apply_steiner_radius` | Выталкивание Steiner-точек за пределы зон исключения |
| 4 | `_apply_constrained_fallback` | Укорочение примыканий терминалов через `steiner:attach:*` |
| 5 | `_ensure_terminal_leaves` | Повторная вставка hub (`steiner:hub:*`) |
| 6 | `_append_attachment_warnings` | Отчёт об оставшихся нарушениях лимитов |
| 7 | `_apply_postprocess` | Разбиение рёбер (`steiner:waypoint:*`) |
| 8 | `_response_from_tree` | Вывод в WGS84; проверка связности `start`↔`end` |

### SteinerPy

Те же шаги, что у GeoSteiner, **начиная с шага 3** (без `_ensure_tree_connected` — вывод SteinerPy уже связный).

---

## Соглашения об ID узлов

| Префикс | Роль | Создаётся |
|---------|------|-----------|
| `terminal:{uuid}` | Входной терминал | Запрос |
| `steiner:0`, `steiner:1`, … | Истинная Steiner-точка от солвера | GeoSteiner / SteinerPy |
| `steiner:hub:*` | Hub на листовом ребре терминала | `normalize_terminal_leaves` при `normalize_terminal_leaves=true` |
| `steiner:attach:*` | Точка на магистрали в пределах лимита примыкания | `apply_attachment_limits` |
| `steiner:waypoint:*` | Промежуточная вершина на длинном ребре | `subdivide_tree_edges` при `edge_vertex_spacing_km > 0` |

**Правило листа:** у каждого терминала степень в графе должна быть 1. Hub и attach допускаются внутри радиуса исключения терминала (`steiner_radius_km`); истинные Steiner-точки выталкиваются к границе зоны.

---

## Справочник параметров

| Параметр | По умолч. | SteinerPy | GeoSteiner | Примечания |
|----------|-----------|-----------|------------|------------|
| `connector_max_km` | 0.2 | лимиты в графе кандидатов + постобработка | только постобработка | Пер-терминал: `terminals[].attachment_max_km` |
| `enforce_attachment_radius` | true | вкл/выкл | вкл/выкл | `false` → чистое SMT, без лимитов |
| `normalize_terminal_leaves` | true | солвер + постобработка | солвер + постобработка | Вставляет `steiner:hub:*` |
| `steiner_hub_prefix` | `steiner:hub` | да | да | Префикс ID hub |
| `steiner_hub_offset_km` | 0 | да | да | Длина ребра терминал→hub; `0` = hub в координатах терминала |
| `edge_vertex_spacing_km` | 0 | постобработка | постобработка | Макс. длина сегмента; добавляет waypoint |
| `attachment_angle_deg` | 90 | веса графа кандидатов | игнорируется | Целевой угол у магистрали |
| `attachment_angle_penalty` | 0 | веса графа кандидатов | игнорируется | `0` отключает штраф |
| `steiner_radius_km` | 0 | фильтр кандидатов + repel | только repel | Диск исключения вокруг каждого терминала |
| `max_points` | 50 | валидация запроса | валидация запроса | Макс. терминалов в запросе |

Подробнее о параметрах: [PARAMETERS.ru.md](PARAMETERS.ru.md).

### Лимиты примыкания

- `connector_max_km` ограничивает **полный листовой путь** от терминала до магистрали (включая терминал→hub, если hub есть).
- Если сырое дерево солвера нарушает лимиты, `apply_attachment_limits` вставляет `steiner:attach:*` на магистраль и переподключает терминал.
- Если лимиты всё равно не выполняются, добавляется предупреждение `solver_fallback:constrained_star` (внутри пробуется звездообразное ограниченное дерево).

### Радиус исключения Steiner (`steiner_radius_km`)

- **Задача:** запретить размещение истинных Steiner-точек ближе R к любому терминалу.
- **SteinerPy:** кандидаты внутри R удаляются из MIP-графа; также применяется post-process repel.
- **GeoSteiner:** только постобработка — `repel_steiner_points` итеративно сдвигает `steiner:*` к границе диска.
- **Пропускаемые префиксы:** `steiner:hub`, `steiner:attach` (мостовые узлы остаются у терминала).
- Предупреждение `{solver}_steiner_radius_vs_attachment_conflict`, когда R > `connector_max_km` и лимиты включены.

### Штраф за угол (только SteinerPy)

Веса рёбер в графе кандидатов умножаются на коэффициент от угла между направлением терминал→магистраль и `attachment_angle_deg`. Больший `attachment_angle_penalty` сильнее тянет примыкания к целевому углу (по умолчанию 90°).

---

## Предупреждения (warnings)

| Warning | Значение |
|---------|----------|
| `solver:steinerpy` / `solver:geosteiner` | Какой endpoint использовался |
| `{solver}_disconnected_components_fixed` | GeoSteiner вернул несколько компонент; топология восстановлена |
| `{solver}_attachment_radius_violation` | Сырой вывод солвера превысил лимиты примыкания; постобработка скорректировала |
| `{solver}_steiner_radius_repel` | Хотя бы одна Steiner-точка сдвинута repel по радиусу исключения |
| `{solver}_steiner_radius_vs_attachment_conflict` | R и лимит connector согласованы плохо |
| `attachment_radius_violations:N` | N терминалов всё ещё превышают лимиты после всех корректировок |
| `solver_fallback:constrained_star` | Лимиты примыкания не удалось полностью выполнить |
| `terminal_degree_violation` | У терминала степень ≠ 1 после нормализации |
| `start_end_not_connected` | Нет пути между `start` и `end` в финальном дереве |

---

## Связность GeoSteiner (n ≥ 13)

Наблюдаемое поведение на плотных наборах терминалов (область Москвы):

- GeoSteiner находит оптимальные **координаты** Steiner-точек, но может вернуть **3+ несвязных FST-подграфа**.
- SteinerPy на тех же точках даёт одно дерево с **той же суммарной длиной** (~46 km против ~54 km при наивных мостовых рёбрах).
- `_ensure_tree_connected` предпочитает пересборку SteinerPy (`steiner_candidates=tree`) вместо прямых мостовых рёбер.

Для предпочтительного пути восстановления нужен установленный SteinerPy.

---

## Интерактивный прототип

`examples/planner_prototype.html` — карта в UI по адресу `/examples/planner_prototype.html`.

- Выбор солвера: SteinerPy / GeoSteiner.
- Параметры фильтруются по `data-scope`: `both`, `steinerpy`, `geosteiner`.
- Цвета узлов: зелёный = `steiner:*`, жёлтый = hub, оранжевый = attach, серый = waypoint.

---

## Структура исходников

```
src/network_planner/
  api/routes.py              HTTP endpoints
  plan/pipeline.py           Оркестрация + постобработка
  schemas/io.py              PlanRequest / PlanResponse
  steiner/
    geosteiner/              запуск efst|bb + разбор сертификата
    steinerpy/               граф кандидатов + HiGHS MIP
    steiner_radius.py        repel_steiner_points
    terminal_attach.py       enforcement лимитов примыкания
    subdivide.py             вставка waypoint на рёбрах
    validate.py              normalize_terminal_leaves
    constrained_star.py      fallback при невыполнимых лимитах
tests/
  test_steiner_radius.py
  test_tree_connectivity.py
  ...
```

---

## Тесты

```bash
pytest
```

Ключевое покрытие: repel радиуса Steiner, `_ensure_tree_connected`, лимиты примыкания, интеграция API.
