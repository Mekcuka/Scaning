# Схема логики расчёта

> **Параметры ввода:** [input-parameters.md](./input-parameters.md).  
> **Объекты карты и якоря расчёта:** [map-objects-and-spatial-calculations.md](./map-objects-and-spatial-calculations.md).  
> **Каталог расчётных функций:** [calculation-functions.md](./calculation-functions.md).

## Общий поток расчёта

> **Схема потоков (PFD)** на вкладке «Потоки» — отдельная ветка: маршруты фаз по графу сети, пропускная способность, перегрузка. Спецификация: [fluid-flow-schematic.md](./fluid-flow-schematic.md). Ниже — поток **анализа окружения и стоимости** (матрица решений).

```mermaid
graph TD
    START((Начало)) --> CreateProject
    CreateProject[Создать проект<br>Задать ставки стоимости] --> LoadInfrastructure
    LoadInfrastructure[Загрузить инфраструктуру<br>API / CSV / Ручное] --> AddPOI
    AddPOI[Добавить точку интереса<br>Инженерные параметры<br>Пороговые расстояния 9 подтипов] --> AnalyzeEnvironment
    AnalyzeEnvironment[Анализ окружения<br>Поиск ближайших объектов] --> ApplyParameters
    ApplyParameters[Применить инженерные параметры<br>Фильтрация подтипов] --> CalculateBaseVariant
    CalculateBaseVariant[Рассчитать базовый вариант<br>Стоимость по подтипам] --> CreateScenarios
    CreateScenarios[Создать сценарии<br>Ручные корректировки] --> BuildMatrix
    BuildMatrix[Построить матрицу решений<br>Критерии для ранжирования] --> RankScenarios
    RankScenarios[Ранжирование сценариев<br>TOPSIS / WSM / AHP] --> SelectFinal
    SelectFinal[Выбрать финальный сценарий] --> ExportReport
    ExportReport[Экспорт отчёта<br>PDF / PPTX] --> END((Конец))

    classDef startend fill:#4CAF50,stroke:#333,stroke-width:2px,color:#fff
    classDef primary fill:#2196F3,stroke:#333,stroke-width:2px,color:#fff
    classDef warning fill:#FF9800,stroke:#333,stroke-width:2px,color:#fff
    classDef purple fill:#9C27B0,stroke:#333,stroke-width:2px,color:#fff

    class START,END startend
    class CalculateBaseVariant primary
    class RankScenarios warning
    class ExportReport purple
```

---

## Выбор якоря расчёта (MVP)

После поиска кандидата по подтипу система определяет, **куда** измеряется расстояние и куда рисуется линия подключения (FR-2.4.4).

```mermaid
graph TD
  POI[POI geometry] --> GeomType{Тип геометрии объекта?}
  GeomType -->|ST_Point| A1[anchor_type = point_object]
  GeomType -->|ST_LineString| A2[anchor_type = line_nearest_point]
  GeomType -->|planned: network_node| A3[anchor = node.geometry]

  A1 --> D1[distance_km = ST_Distance geodesic POI to Point]
  A2 --> D2[distance_km = ST_Distance geodesic POI to Line]
  A2 --> C2[anchor_geometry = ST_ClosestPoint line POI]

  D1 --> Save[poi_infrastructure_analysis]
  D2 --> Save
  C2 --> Save
```

---

## Детальный поток анализа окружения

```mermaid
graph TD
    P[Инженерные параметры] --> E[Электроснабжение]
    P --> I[Закачка]
    P --> G[Утилизация газа]
    P --> Prep[Подготовка нефти<br>5 вариантов]
    P --> WG[Сбор скважин<br>только отображение]
    P --> T[Транспортировка]
    P --> D[Пороговые расстояния<br>8 значений]

    D --> A1[Автодорога]
    D --> A2[Нефтепровод]
    D --> A3[Водопровод]
    D --> A4[ЛЭП]
    D --> A5[Кустовые площадки<br>Math.ceil]
    D --> A6[ГКС]
    D --> A7[ГТЭС/ГПЭС]
    D --> A8[ПС/ТП]
    D --> A9[НПЗ]

    E --> F1{Электроснабжение?}
    I --> F2{Закачка?}
    G --> F3{Утилизация газа?}
    T --> F4{Транспортировка?}

    F1 -->|Внешнее| A4
    F1 -->|Внутреннее| A7

    F2 -->|Централизованная| A3
    F2 -->|Локальная| A3

    F3 -->|В пласт| SkipG[ГТЭС не требуется]
    F3 -->|Факел| SkipG
    F3 -->|Электрогенерация| A7

    F4 -->|Автовывоз| SkipT[Нефтепровод и НПЗ не требуются]
    F4 -->|Морской порт| A2
    F4 -->|Магистральный| A9

    A1 --> I1[pads_count x km_per_pad]
    A2 --> I1
    A3 --> I1
    A4 --> I1
    A5 --> R2[Статус КП]
    A6 --> E1[Geodesic + ближайший Point]
    A7 --> E1
    A8 --> E1
    A9 --> E1

    I1 --> S1[Статус internal vs max_total_line_*]
    E1 --> S2[Статус external vs max_distance_*]
    SkipG --> Merge[Сводка варианта]
    SkipT --> Merge
    S1 --> Merge
    S2 --> Merge

    classDef gray fill:#9e9e9e,stroke:#333,stroke-width:2px,color:#fff
    class SkipG,SkipT gray
```

---

## Поток расчёта стоимости

```mermaid
graph TD
    C1[Линейные внутренние] --> L1[Автодорога<br>расстояние x ставка]
    C1 --> L2[Нефтепровод<br>расстояние x ставка]
    C1 --> L3[Водопровод<br>расстояние x ставка]
    C1 --> L4[ЛЭП<br>расстояние x ставка]

    C2[Площадные внешние] --> L5[ГКС<br>фиксированная ставка]
    C2 --> L6[ГТЭС/ГПЭС<br>фиксированная ставка]
    C2 --> L7[ПС/ТП<br>фиксированная ставка]
    C2 --> L8[НПЗ<br>фиксированная ставка / нефтепровод]

    C4[Кустовые площадки] --> K1[Количество = Math.ceil<br>(Объём добычи / Добыча на скважину / Скважин на КП)]
    K1 --> K2[Стоимость = Количество x ставка за шт.]

    C5[Инженерное оборудование] --> E1[Электроснабжение<br>Внешнее = 0 / Внутреннее = ставка ГТЭС]
    C5 --> E2[Закачка<br>Централизованная = 0 / Локальная = ставка насосной]
    C5 --> E3[Утилизация газа<br>В пласт/Факел = 0 / Электрогенерация = ставка ГПЭС]
    C5 --> E4[Подготовка нефти<br>МФНС = 0 / иначе ставка по типу]
    C5 --> E5[Транспортировка<br>Автовывоз = 0 / Порт = стоимость нефтепровода / Труба = стоимость нефтепровода]

    L1 --> T1[Сумма всех подтипов]
    L2 --> T1
    L3 --> T1
    L4 --> T1
    L5 --> T1
    L6 --> T1
    L7 --> T1
    L8 --> T1
    K2 --> T1

    E1 --> T2[Сумма инженерного оборудования]
    E2 --> T2
    E3 --> T2
    E4 --> T2
    E5 --> T2

    T1 --> T3[Итого = T1 + T2]
    T2 --> T3

    classDef blue fill:#2196F3,stroke:#333,stroke-width:2px,color:#fff
    classDef green fill:#4CAF50,stroke:#333,stroke-width:2px,color:#fff
    classDef purple fill:#9C27B0,stroke:#333,stroke-width:2px,color:#fff

    class T3 green
    class C1,C2,C3,C4,C5 blue
    class E1,E2,E3,E4,E5 purple
```

---

## Определение статусов

```mermaid
graph TD
    S1[within_limit<br>В пределах лимита<br>Приоритет 3]
    S2[exceeds_limit<br>Превышение лимита<br>Приоритет 1]
    S3[construction_required<br>Строительство<br>Приоритет 2]
    S4[not_required<br>Не требуется<br>Приоритет 4]

    L0{Подтип активен?}
    L0 -->|Нет| S4
    L0 -->|Да| LKind{Внешний или internal linear?}
    LKind -->|Внешний| L1{Объект найден?}
    L1 -->|Нет| S3
    L1 -->|Да| L2{distance ≤ max_distance_*?}
    L2 -->|Да| S1
    L2 -->|Нет| S2
    LKind -->|Internal linear| L3{Явное строительство?}
    L3 -->|Да| S3
    L3 -->|Нет| L4{pads×km_per_pad ≤ max_total_line_*?}
    L4 -->|Да| S1
    L4 -->|Нет| S2

    O1{Есть exceeds_limit?}
    O2{Есть construction_required?}
    O3{Есть within_limit?}
    O4[Все not_required]

    O1 -->|Да| R1[exceeds_limit]
    O1 -->|Нет| O2
    O2 -->|Да| R2[construction_required]
    O2 -->|Нет| O3
    O3 -->|Да| R3[within_limit]
    O3 -->|Нет| O4
    O4 --> R4[not_required]

    classDef red fill:#f44336,stroke:#333,stroke-width:2px,color:#fff
    classDef orange fill:#ff9800,stroke:#333,stroke-width:2px,color:#fff
    classDef green fill:#4caf50,stroke:#333,stroke-width:2px,color:#fff
    classDef gray fill:#9e9e9e,stroke:#333,stroke-width:2px,color:#fff
    classDef blue fill:#2196F3,stroke:#333,stroke-width:2px,color:#fff

    class S2,R1 red
    class S3,R2 orange
    class S1,R3 green
    class S4,R4 gray
    class R1,R2,R3,R4 blue
```

---

## Матрица решений и ранжирование

```mermaid
graph TD
    B[Базовый вариант]
    S1[Сценарий 1]
    S2[Сценарий 2]
    S3[Сценарий N]

    C1[Стоимость]
    C2[Суммарные расстояния]
    C3[Количество превышений]
    C4[Риск реализации]
    C5[Срок реализации]
    C6[Надёжность]

    B --> M1
    S1 --> M1
    S2 --> M1
    S3 --> M1

    C1 --> M1[Матрица оценок<br>Сценарии x Критерии]
    C2 --> M1
    C3 --> M1
    C4 --> M1
    C5 --> M1
    C6 --> M1

    M1 --> M2[Веса критериев<br>AHP / Ручные]
    M1 --> M3[Нормализация<br>Min-Max / Z-score]

    M2 --> A1[TOPSIS]
    M2 --> A2[WSM]
    M2 --> A3[AHP]
    M3 --> A1
    M3 --> A2
    M3 --> A3

    A1 --> R1[Рейтинг сценариев]
    A2 --> R1
    A3 --> R1

    R1 --> R2[Визуализация<br>Радар / Столбчатый]
    R1 --> R3[Рекомендация]

    classDef orange fill:#FF9800,stroke:#333,stroke-width:2px,color:#fff
    classDef blue fill:#2196F3,stroke:#333,stroke-width:2px,color:#fff
    classDef green fill:#4CAF50,stroke:#333,stroke-width:2px,color:#fff
    classDef purple fill:#9C27B0,stroke:#333,stroke-width:2px,color:#fff

    class B,S1,S2,S3 orange
    class C1,C2,C3,C4,C5,C6 blue
    class A1,A2,A3 green
    class R1,R2,R3 purple
```

---

## Поток создания и сравнения сценариев

```mermaid
graph TD
    Start((Базовый вариант)) --> Decision{Изменить?}
    Decision -->|Да| Change[Изменить параметр]
    Decision -->|Нет| Save[Сохранить как есть]

    Ch1[Выбрать альтернативный объект]
    Ch2[Переключить на строительство]
    Ch3[Скорректировать стоимость вручную]
    Ch4[Изменить инженерный параметр]

    Change --> Ch1
    Change --> Ch2
    Change --> Ch3
    Change --> Ch4

    Rec1[Обновить подтип]
    Rec2[Пересчитать стоимость]
    Rec3[Обновить статус]
    Rec4[Пересчитать общую стоимость]
    Rec5[Сохранить в variant_cost_overrides]

    Ch1 --> Rec1
    Ch2 --> Rec1
    Ch3 --> Rec2
    Ch4 --> Rec3
    Ch3 --> Rec5
    Rec1 --> Rec4
    Rec2 --> Rec4
    Rec3 --> Rec4

    SaveAs[Сохранить как новый сценарий<br>variant_infrastructure_items]

    Save --> SaveAs
    Rec4 --> SaveAs

    SaveAs --> Compare[Сравнить сценарии]
    Compare --> Matrix[Вертикальная матрица]
    Matrix --> Filter[Фильтровать по критериям]
    Filter --> Select[Выбрать финальный]
    Select --> Export[Экспорт отчёта]

    classDef blue fill:#2196F3,stroke:#333,stroke-width:2px,color:#fff
    classDef green fill:#4CAF50,stroke:#333,stroke-width:2px,color:#fff
    classDef purple fill:#9C27B0,stroke:#333,stroke-width:2px,color:#fff

    class Start blue
    class Export purple
    class SaveAs,Select green
```

---

## Экспорт отчёта (одностраничник)

```mermaid
graph TD
    SelectScenario[Выбрать финальный сценарий] --> Generate[Генерировать отчёт]

    St1[Заголовок<br>Название, координаты, инженер, дата]
    St2[Карта<br>Точка + линии до объектов]
    St3[Финальный вариант<br>Таблица с 9 подтипами]
    St4[Инженерные параметры<br>Иконки с детализацией стоимости]
    St5[Дорожная карта<br>Разведка - Эксплуатация]
    St6[Рекомендация<br>Текст + редактирование]

    Generate --> St1
    Generate --> St2
    Generate --> St3
    Generate --> St4
    Generate --> St5
    Generate --> St6

    F1[PDF<br>Печатная версия]
    F2[PPTX<br>Презентация]

    St1 --> F1
    St2 --> F1
    St3 --> F1
    St4 --> F1
    St5 --> F1
    St6 --> F1

    St1 --> F2
    St2 --> F2
    St3 --> F2
    St4 --> F2
    St5 --> F2
    St6 --> F2

    S1[В проекте]
    S2[Скачать файл]

    F1 --> S1
    F1 --> S2
    F2 --> S1
    F2 --> S2

    classDef purple fill:#9C27B0,stroke:#333,stroke-width:2px,color:#fff
    classDef green fill:#4CAF50,stroke:#333,stroke-width:2px,color:#fff

    class Generate purple
    class S1,S2 green
```

---

## Взаимодействие инженерных параметров

```mermaid
graph LR
    P1[Электроснабжение]
    P2[Закачка]
    P3[Утилизация газа]
    P4[Подготовка нефти]
    P4b[Сбор скважин]
    P5[Транспортировка]

    I1[ЛЭП]
    I2[ГТЭС/ГПЭС]
    I3[Водопровод]
    I4[Нефтепровод]
    I5[НПЗ]
    I7[ГКС]

    Skip1[--]
    Skip2[--]
    Skip3[--]

    P1 -->|Внешнее| I1
    P1 -->|Внутреннее| I2

    P2 -->|Централизованная| I3
    P2 -->|Локальная| I3

    P3 -->|В пласт| Skip1
    P3 -->|Факел| Skip2
    P3 -->|Электрогенерация| I2

    P4b -.->|только UI| Skip3[--]

    P5 -->|Автовывоз| I4
    P5 -->|Морской порт| I4
    P5 -->|Магистральный| I5

    classDef gray fill:#9e9e9e,stroke:#333,stroke-width:2px,color:#fff
    classDef blue fill:#2196F3,stroke:#333,stroke-width:2px,color:#fff

    class Skip1,Skip2,Skip3 gray
    class P1,P2,P3,P4,P4b,P5 blue
```

---

## Приоритет статусов

```mermaid
graph TD
    Start((Статус подтипа)) --> Check1{exceeds_limit?}
    Check1 -->|Да| R1[exceeds_limit<br>Приоритет 1]
    Check1 -->|Нет| Check2{construction_required?}
    Check2 -->|Да| R2[construction_required<br>Приоритет 2]
    Check2 -->|Нет| Check3{within_limit?}
    Check3 -->|Да| R3[within_limit<br>Приоритет 3]
    Check3 -->|Нет| R4[not_required<br>Приоритет 4]

    O1[Проверить все активные подтипы]
    O2[Выбрать наихудший приоритет]
    O3[not_required не учитывается]

    R1 --> O1
    R2 --> O1
    R3 --> O1
    R4 --> O1

    O1 --> O2 --> O3 --> Final[Финальный статус]

    classDef red fill:#f44336,stroke:#333,stroke-width:2px,color:#fff
    classDef orange fill:#ff9800,stroke:#333,stroke-width:2px,color:#fff
    classDef green fill:#4caf50,stroke:#333,stroke-width:2px,color:#fff
    classDef gray fill:#9e9e9e,stroke:#333,stroke-width:2px,color:#fff
    classDef blue fill:#2196F3,stroke:#333,stroke-width:2px,color:#fff

    class R1 red
    class R2 orange
    class R3 green
    class R4 gray
    class Final blue
```

---

## Логика расчёта кустовых площадок

```mermaid
graph TD
    Start((Входные данные)) --> Input1[Плановый объём добычи]
    Input1 --> Input2[Добыча на 1 скважину]
    Input2 --> Input3[Скважин на одной КП]

    C1[Суммарное количество скважин<br>= Объём добычи / Добыча на скважину]
    C2[Количество КП<br>= Суммарное количество скважин / Скважин на КП]
    C3[Округление вверх<br>Math.ceil КП]

    Input1 --> C1
    Input2 --> C1
    C1 --> C2
    Input3 --> C2
    C2 --> C3

    Cost1[Ставка за КП]
    Cost2[Итого = Количество КП x Ставка]

    C3 --> Cost1
    Cost1 --> Cost2

    Example[Пример:<br>Объём = 50 тыс. тн/год<br>Добыча = 10 тыс. тн/год<br>Скважин = 4<br>Скважин всего = 5<br>КП = 5/4 = 1.25, округлено до 2]

    Example --> Cost2

    classDef blue fill:#2196F3,stroke:#333,stroke-width:2px,color:#fff
    classDef green fill:#4CAF50,stroke:#333,stroke-width:2px,color:#fff
    classDef orange fill:#FF9800,stroke:#333,stroke-width:2px,color:#fff

    class Start blue
    class Cost2 green
    class Example orange
```

---

## Полный цикл от проекта до отчёта

```mermaid
graph TD
    P1[Создать проект]
    P2[Задать ставки стоимости<br>16 показателей, тыс. ₽]
    P2a[Пороги и нормы проекта<br>4 external + 4 max_total_line + 4 km/КП]
    P3[Загрузить инфраструктуру<br>API / CSV / Ручное]

    P4[Добавить точку интереса<br>флюид, добыча, закачка воды]
    P4a[Применить тип флюида<br>oil / gas]
    P5[Задать инженерные параметры<br>6 параметров]
    P6[Пороги POI<br>4 external + 4 max_total_line + 4 km/КП]

    P7[Анализ окружения<br>Поиск ближайших объектов]
    P8[Применить фильтрацию<br>по инженерным параметрам]
    P9[Рассчитать базовый вариант<br>Стоимость + Статусы]

    P10[Создать сценарии]
    P11[Ручные корректировки]
    P12[Сравнить сценарии]

    P12b[Ввести экспертные оценки<br>по сценариям]
    P13[Построить матрицу ранжирования<br>6 критериев]
    P14[Применить алгоритм<br>TOPSIS / WSM / AHP]
    P15[Получить рейтинг сценариев]

    P16[Выбрать финальный сценарий]
    P17[Генерировать одностраничник]
    P18[Экспорт PDF / PPTX]

    P1 --> P2 --> P2a --> P3 --> P4 --> P4a --> P5 --> P6 --> P7 --> P8 --> P9 --> P10 --> P11 --> P12 --> P12b --> P13 --> P14 --> P15 --> P16 --> P17 --> P18

    classDef green fill:#4CAF50,stroke:#333,stroke-width:2px,color:#fff
    classDef blue fill:#2196F3,stroke:#333,stroke-width:2px,color:#fff
    classDef orange fill:#FF9800,stroke:#333,stroke-width:2px,color:#fff
    classDef purple fill:#9C27B0,stroke:#333,stroke-width:2px,color:#fff

    class P1 green
    class P9 blue
    class P15 orange
    class P18 purple
```

---

## Легенда

| Символ | Значение |
|--------|----------|
| 🔴 | Превышение лимита (exceeds_limit) |
| 🟠 | Строительство (construction_required) |
| 🟢 | В пределах лимита (within_limit) |
| ⚪ | Не требуется (not_required) |
| ✏️ | Ручная корректировка |
| 📊 | Матрица решений |
| 📈 | Ранжирование |
| 📄 | Отчёт |