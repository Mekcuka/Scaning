# Модель данных: WebSocket + журнал расчётов

**Дата:** 2026-06-16

## Новая таблица: `project_job_steps`

Хранит пошаговую детализацию выполнения фоновой задачи.

| Колонка | Тип | Nullable | Default | Описание |
|---------|-----|----------|---------|----------|
| `id` | `Uuid` | NO (PK) | `gen_random_uuid()` | Уникальный ID шага |
| `job_id` | `Uuid` | NO | — | FK → `project_jobs.id` (`ON DELETE CASCADE`) |
| `project_id` | `Uuid` | NO | — | FK → `projects.id` (`ON DELETE CASCADE`), индекс |
| `seq` | `Integer` | NO | — | Порядковый номер шага внутри задачи (1, 2, 3...) |
| `step_code` | `String(64)` | NO | — | Машинный идентификатор (`fetch_dem`, `compute_volumes`) |
| `title` | `String(255)` | NO | — | Человекочитаемое название (русский) |
| `status` | `String(32)` | NO | `'pending'` | `pending`/`running`/`ok`/`warn`/`error`/`skipped` |
| `started_at` | `DateTime(timezone=True)` | YES | — | Время старта шага |
| `finished_at` | `DateTime(timezone=True)` | YES | — | Время завершения |
| `duration_ms` | `Integer` | YES | — | Длительность в мс (`finished_at - started_at`) |
| `detail` | `JSON` | YES | `NULL` | Структурированные артефакты шага (числа, ids, warnings) |
| `error_message` | `Text` | YES | `NULL` | Текст ошибки (если `status = 'error'`) |
| `created_at` | `DateTime(timezone=True)` | NO | `now()` | Время создания записи |

### Индексы

| Имя | Колонки | Где | Назначение |
|-----|---------|-----|------------|
| `ix_project_job_steps_job_id` | `job_id` | — | быстрый fetch шагов задачи |
| `ix_project_job_steps_project_id` | `project_id` | — | фильтрация по проекту |
| `uq_project_job_steps_job_seq` | `job_id, seq` | — | UNIQUE — гарантирует уникальность seq в рамках job |

### Constraints

```sql
CHECK (status IN ('pending', 'running', 'ok', 'warn', 'error', 'skipped'))
CHECK (seq > 0)
```

### Связи

```
project_jobs (1) ──── (N) project_job_steps
    ON DELETE CASCADE              ← шаги умирают с задачей
    
projects (1) ──── (N) project_job_steps
    ON DELETE CASCADE
```

## Существующая таблица `project_jobs` (изменения)

Таблица уже существует (миграция `019_project_jobs`). **Поле `progress` уже есть, но не пишется.** Новых колонок в `project_jobs` НЕ добавляем — агрегаты (`steps_total`, `steps_completed`, `current_step`) вычисляются на лету в service-слое из `project_job_steps`.

| Существующее поле | Статус | Действие |
|-------------------|--------|----------|
| `progress Float nullable` | существует (`:415`) | **начать писать** — `completed_steps / total_steps` |
| `status String(32)` | существует | без изменений |
| `result JSON` | существует | без изменений |

**Обратная совместимость:** для задач без шагов (старые записи, неинструментированные `job_type`) — `progress` остаётся `null`, `steps_total = 0`.

## Миграция: `026_calculation_journal`

- **revision:** `026_calculation_journal`
- **down_revision:** `025_footprint_conn_tpl`
- **Тип:** async (как все миграции проекта, `env.py` через `asyncio.run`)

### Idempotent-проверка (по конвенции проекта)

```python
def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "project_job_steps" in insp.get_table_names():
        return
    # ... create_table, create_index
```

### Downgrade

```python
def downgrade() -> None:
    op.drop_index("uq_project_job_steps_job_seq", table_name="project_job_steps")
    op.drop_index("ix_project_job_steps_project_id", table_name="project_job_steps")
    op.drop_index("ix_project_job_steps_job_id", table_name="project_job_steps")
    op.drop_table("project_job_steps")
```

## SQLAlchemy-модель (для `app/models/__init__.py`)

```python
class ProjectJobStep(Base):
    __tablename__ = "project_job_steps"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    job_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("project_jobs.id", ondelete="CASCADE"),
        index=True,
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("projects.id", ondelete="CASCADE"),
        index=True,
    )
    seq: Mapped[int] = mapped_column(Integer)
    step_code: Mapped[str] = mapped_column(String(64))
    title: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(32), default="pending")
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    detail: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
```

**Relationship** (добавить в `ProjectJob`):
```python
steps: Mapped[list["ProjectJobStep"]] = relationship(
    back_populates="job",
    cascade="all, delete-orphan",
    order_by="ProjectJobStep.seq",
)
```

## Redis pub/sub (временное хранилище событий)

**Не персистентное** — только транспорт. Канал `job-events:{project_id}`, сообщения не сохраняются. Если web-процесс не подписан в момент публикации — событие теряется. Для пропущенных событий клиент использует REST `GET /jobs/{job_id}/steps` (snapshot) при восстановлении соединения.

## Сессии БД (важно для worker)

Worker пишет шаги в **отдельную короткую сессию** (как `db2` для `mark_job_failed` в `project_job_run.py:270`), чтобы шаги:
1. Немедленно коммитились (видны в UI без ожидания основного commit)
2. Переживали rollback основной сессии при ошибке

Паттерн:
```python
async def append_job_step(job_id, project_id, seq, step_code, title, status, **kw):
    async with async_session() as db:
        step = ProjectJobStep(job_id=job_id, project_id=project_id, seq=seq, ...)
        db.add(step)
        await db.commit()
        # publish event after commit
        await publish_job_event(project_id, {"type": "job.step_added", ...})
        return step
```
