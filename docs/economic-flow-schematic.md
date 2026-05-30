# Экономический поток (на основе PFD)

Нижнее окно **«Экономический поток»** на странице `/flows` показывает ту же топологию, что технологическая PFD, с расчётом **CAPEX**, **OPEX** и **выручки** по ставкам проекта.

**Связанные документы:** [fluid-flow-schematic.md](./fluid-flow-schematic.md), [calculation-logic-flow.md](./calculation-logic-flow.md).

**Дата актуализации:** май 2026.

---

## 1. Назначение

- Наследовать **узлы и рёбра** из `GET .../flow-schematic` (те же `id`, позиции макета).
- Рассчитать **разовый CAPEX** и **годовой OPEX / выручку** на каждом узле.
- Показать **итоги** (CAPEX, OPEX/год, выручка/год, net/год) в summary bar.
- Предупреждать о пропущенных ценах, отсутствии ставки БКНС и т.п.

Экономическая схема **read-only** — правки стоимости через ставки CAPEX (`project_cost_rates`), цены/OPEX (`project_economic_params`) или инфраструктурную матрицу POI.

---

## 2. Источники данных

| Источник | Роль |
|----------|------|
| Технологическая PFD | Топология, `flow_annual`, `length_km`, `infrastructure_object_id` |
| `project_cost_rates` | CAPEX: кусты, оборудование, трубы (₽/км), терминалы |
| `project_economic_params` | Цены нефти/газа, OPEX труб и узлов |
| POI | Число кустов, закачка воды, `eng_transport` (автовывоз → выручка) |

**API:**

| Метод | Путь | Назначение |
|-------|------|------------|
| GET | `/api/v1/projects/{id}/pois/{poi_id}/economic-flow-schematic` | Построить экономическую схему |
| GET/PUT | `/api/v1/projects/{id}/economic-params` | Цены и OPEX-ставки |

---

## 3. Единицы

| Показатель | Единица в API | Отображение в UI |
|------------|---------------|------------------|
| CAPEX узла | тыс. ₽ (разово) | млн ₽ |
| OPEX узла | тыс. ₽/год | млн ₽/год |
| Выручка узла | тыс. ₽/год | млн ₽/год |
| Summary | млн ₽ или млн ₽/год | — |
| Цена нефти | тыс. ₽/т | Страница «Ставки» |
| Цена газа | тыс. ₽/тыс. м³ | Страница «Ставки» |

**Net на узле** = выручка − OPEX (CAPEX в net не входит; амортизация CAPEX — не в v1).

---

## 4. Формулы CAPEX (тыс. ₽)

| `kind` | Условие | Формула |
|--------|---------|---------|
| `poi` | — | `pads_count × rate_pads` |
| `process` | mkos/bmupn/cps/upsv | `rates[OIL_PREP_RATE_MAP[subtype]]` |
| `network_segment` | oil/water/gas pipeline | `length_km × rate_{pipeline}` |
| `terminal` | refinery, gas_processing, … | `rates[subtype]` |
| `utilization` | «В пласт», локальная закачка | `eq_injection` |
| `separator`, `fluid_branch` | — | 0 |

Длина сегмента берётся из поля `length_km` узла или парсится из подписи `(N км)`.

---

## 5. Формулы OPEX (тыс. ₽/год)

| Узел | Формула |
|------|---------|
| `poi` | `pads_count × opex_pads_per_pad` |
| `network_segment` | `length_km × opex_{pipeline}_per_km` |
| `process` | `opex_eq_{subtype}` |
| `terminal` | `opex_{subtype}` |
| `utilization` «В пласт» | `opex_eq_injection` при `water_injection_volume > 0` |

---

## 6. Выручка (тыс. ₽/год)

| Узел | Условие | Формула |
|------|---------|---------|
| `terminal` + oil | refinery, oil_pumping_station | `flow_annual × oil_price` |
| `terminal` + gas | gas_processing, gtes, gpes, vies | `flow_annual × gas_price` |
| `utilization` | «Автовывоз», нефтяной POI | `flow_annual × oil_price` |

Если поток > 0, а цена = 0 → warning `missing_oil_price` / `missing_gas_price`.

---

## 7. Связь с матрицей и анализом окружения

- **PFD** считает CAPEX труб по **фактической длине маршрута** (`length_km` на сегменте).
- **Матрица / анализ окружения** для внутренних линий использует `кусты × км/КП` — суммы могут расходиться; это ожидаемо в v1.
- Для терминалов с `infrastructure_object_id` в будущем возможна сверка с `AnalysisRow.cost_mln` (warning `economic_analysis_mismatch`).

---

## 8. Frontend

| Слой | Компонент / модуль |
|------|-------------------|
| UI | `FlowSchematicPage`, `EconomicFlowSchematic` |
| Ставки | `RatesPage` → секция «Экономика потока» |
| API-клиент | `getEconomicFlowSchematic`, `getEconomicParams`, `updateEconomicParams` |
| Backend | `economic_flow_schematic.py`, `economic_rates.py`, `flow.py` |

Invalidate `economic-flow-schematic` при сохранении PFD, изменении POI или ставок.

---

## 9. Ограничения v1

- Нет отдельного layout для экономики — позиции копируются из tech-схемы.
- Нет ставки CAPEX для **БКНС** — добавлена в `project_cost_rates` (`ground_pumping_station`, по умолчанию 400 000 тыс. ₽); OPEX — `opex_ground_pumping_station`.
- Амортизация CAPEX не включена в net.
- Ручные override стоимости — только через матрицу (`variant_cost_overrides`).
