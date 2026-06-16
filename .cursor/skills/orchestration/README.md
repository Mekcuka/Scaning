# Оркестрация разработки: 4 роли

Система конвейерной разработки веб-приложений в Cursor: от постановки задачи до деплоя.

## Когда применять

Любая задача, затрагивающая **больше 3 файлов** или **новую фичу/микросервис**, проходит обязательный конвейер. Мелкие правки (1–2 файла, фиксы) — без конвейера.

## Роли

| # | Роль | Skill | Выходной артефакт |
|---|------|-------|-------------------|
| 1 | **Planner** | `feature-planner` | `plan.md`, `contract.md`, `data-model.md` |
| 2 | **Builder** | `microservice-builder` | код + `impl-log.md` |
| 3 | **Reviewer** | `integration-reviewer` | `review-report.md` |
| 4 | **Integrator** | `integrator` | миграции, docker, CI green |

## Конвейер

```
Пользователь → Planner → Builder → Reviewer → Integrator → Deploy
                  ↑          ↑         │
                  └──────────┘         └── при красном → Builder
```

**Жёсткие правила:**
- Последовательное исполнение (Builder: микросервис → BFF → frontend)
- Approval пользователя на каждой фазе
- Жёсткие гейты (hooks блокируют push без тестов)
- Возврат к предыдущей роли при нарушениях

## Как запустить конвейер

### 1. Planner

Скажите агенту:
> «Нужна новая фича: <описание>. Запусти конвейер оркестрации, начиная с Planner.»

Агент загрузит skill `feature-planner`, запустит explore-сабажентов, создаст артефакты в `docs/features/<feature>/`.

### 2. Builder (после подтверждения)

> «Переходим к Builder.»

Агент загрузит skill `microservice-builder`, реализует последовательно: микросервис → BFF → frontend.

### 3. Reviewer (после подтверждения)

> «Переходим к Reviewer.»

Агент загрузит skill `integration-reviewer`, запустит bugbot + тесты, сверит контракт, выдаст вердикт.

### 4. Integrator (после зелёного Reviewer)

> «Переходим к Integrator.»

Агент загрузит skill `integrator`, применит миграции, обновит docker, прогонит E2E, получит зелёный CI.

## Hooks (жёсткие гейты)

Конфиг: `.cursor/hooks.json`. Скрипты: `.cursor/hooks/*.py`.

| Hook | Событие | Поведение |
|------|---------|-----------|
| `gate-push-tests.py` | `beforeShellExecution` (git push) | **block** если нет свежего тест-прогона |
| `lint-frontend.py` | `afterFileEdit` (frontend .ts/.tsx) | сообщит об ESLint ошибках |
| `qa-loop-bugbot.py` | `subagentStop` (bugbot) | loop к Builder при findings (max 2) |
| `chain-after-explore.py` | `subagentStop` (explore) | напоминает Planner создать артефакты |
| `remind-tests-if-frontend.py` | `stop` | напоминает прогнать тесты после правок FE |
| `mark-tests-ok.py` | ручной запуск | снимает блокировку push |

### Снять блокировку push

После успешного прогона:
```bash
cd decision-matrix/backend && pytest tests/ -q
cd ../frontend && npm run test
```
запустите:
```bash
python .cursor/hooks/mark-tests-ok.py
```
Это создаст маркер, и `git push` будет разрешён.

## Структура файлов

```
.cursor/
├── rules/
│   └── orchestration.mdc          ← конституция конвейера (alwaysApply)
├── skills/
│   ├── feature-planner/SKILL.md
│   ├── microservice-builder/SKILL.md
│   ├── integration-reviewer/SKILL.md
│   └── integrator/SKILL.md
├── hooks.json                     ← конфиг хуков
└── hooks/
    ├── gate-push-tests.py
    ├── lint-frontend.py
    ├── qa-loop-bugbot.py
    ├── chain-after-explore.py
    ├── remind-tests-if-frontend.py
    ├── mark-tests-ok.py
    └── state/                     ← маркеры (gitignored)
```

## Антипаттерны

- Planner пишет код
- Builder меняет архитектуру без возврата к Planner
- Reviewer фиксит сам
- Integrator правит прод-код
- Push без тестов (заблокировано hook'ом)
- Параллельный Builder (контракт дрейфит) — только последовательно
- Авто-handoff без approval пользователя

## Связанные правила

- [`russian-language.mdc`](rules/russian-language.mdc) — UI тексты на русском
- [`pre-deploy-ci.mdc`](rules/pre-deploy-ci.mdc) — CI gate перед деплоем
- [`ui-guidelines.mdc`](rules/ui-guidelines.mdc) — паттерны frontend
- [`module-boundaries.md`](../../docs/architecture/module-boundaries.md) — границы слоёв
