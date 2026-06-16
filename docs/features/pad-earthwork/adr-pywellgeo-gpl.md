# ADR: PyWellGeo (GPL) в Atlas Grid

**Status:** accepted (P0, июнь 2026)  
**Связано:** [well-trajectory-data-model.md](../well-trajectory/well-trajectory-data-model.md), [well-trajectory.md](../well-trajectory/well-trajectory.md)

## Контекст

PyWellGeo (v0.1.1, GPL-3.0) используется для расширенной геометрии скважин (WellTree, ветви, AHD, thermal/DC1D). Библиотека уже устанавливается в vendor-образ backend через `well-trajectory-vendor` и вызывается из `pywellgeo_bridge.py` после расчётов welleng.

Новая вкладка «PyWellGeo» на странице «Кустование» открывает полный API библиотеки **дополнительно** к pipeline welleng (design, ISCWSA clearance, импорт `.wbp` не меняются).

## Решение

1. **Распространение:** PyWellGeo остаётся в том же Python-процессе, что и `well-trajectory-planner` / backend monolith (in-process adapter), как сейчас для `enrich_survey_geometry`.
2. **Compliance GPL-3.0:**
   - Исходники PyWellGeo и pythermonomics доступны через PyPI / vendor lockfile.
   - В документации продукта явно указано использование GPL-компонента и ссылка на репозиторий/версию.
   - При необходимости выделения в отдельный GPL-сервис — отдельный ADR (не блокирует P0–P1).
3. **Граница ответственности:** welleng `survey.stations` — канон для clearance; PyWellGeo `WellTree` — канон для ветвей, AHD, thermal; односторонний sync «из survey» без автоматической перезаписи welleng.
4. **Данные:** per-pad JSON в `properties` (`pad_pywellgeo_*`), без миграций БД.

## Последствия

- Docker-образ backend/vendor уже содержит pywellgeo — дополнительных образов не требуется.
- Юридический review рекомендуется перед публичным SaaS; ADR фиксирует текущую практику команды.
- Тесты с маркером `@pytest.mark.pywellgeo` пропускаются, если пакет не установлен.

## Альтернативы (отклонены)

| Вариант | Причина отказа |
|---------|----------------|
| Заменить welleng на PyWellGeo | Нет ISCWSA clearance / design API |
| Переписать WellTree in-house | Дублирование GPL-кода, высокая стоимость |
| Отложить ADR | Риск неформализованного GPL-использования в prod |
