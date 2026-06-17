#!/usr/bin/env python3
"""Sync Scaning orchestration features (docs/features/*) with Kaiten board cards."""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
FEATURES_ROOT = REPO_ROOT / "docs" / "features"
CONFIG_PATH = REPO_ROOT / "scripts" / "kaiten.config.json"
TASKS_REGISTRY_PATH = REPO_ROOT / "scripts" / "kaiten" / "tasks-registry.json"
KAITEN_META = "kaiten.json"

sys.path.insert(0, str(REPO_ROOT / "scripts"))

from kaiten.client import KaitenClient, KaitenError  # noqa: E402
from kaiten.feature_phase import FeaturePhase, list_pipeline_features  # noqa: E402
from kaiten.project_tasks import (  # noqa: E402
    ProjectTask,
    card_description as task_card_description,
    card_title as task_card_title,
    collect_all_tasks,
)


def _load_config() -> dict[str, Any]:
    if not CONFIG_PATH.is_file():
        raise KaitenError(f"Config not found: {CONFIG_PATH}")
    return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))


def _load_dotenv() -> None:
    env_path = REPO_ROOT / ".env"
    if not env_path.is_file():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        import os

        os.environ.setdefault(key, value)


def _meta_path(feature_dir: Path) -> Path:
    return feature_dir / KAITEN_META


def _read_meta(feature_dir: Path) -> dict[str, Any]:
    path = _meta_path(feature_dir)
    if not path.is_file():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def _write_meta(feature_dir: Path, meta: dict[str, Any]) -> None:
    path = _meta_path(feature_dir)
    path.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _card_title(config: dict[str, Any], phase: FeaturePhase) -> str:
    prefix = str(config.get("card_title_prefix") or "[Scaning]").strip()
    return f"{prefix} {phase.name}"


def _card_description(config: dict[str, Any], phase: FeaturePhase) -> str:
    labels = config.get("role_labels") or {}
    role_label = labels.get(phase.role, phase.role)
    github = config.get("github_repo", "https://github.com/Mekcuka/Scaning")
    approval = "да" if phase.awaiting_approval else "нет"
    lines = [
        f"**Фича Scaning:** {phase.name}",
        f"**Роль:** {role_label}",
        f"**Фаза:** {phase.phase}",
        f"**Ждёт approval:** {approval}",
        "",
        f"Документация: `docs/features/{phase.feature_id}/`",
        f"Репозиторий: {github}",
        f"Обновлено: {phase.last_update}",
    ]
    if phase.notes:
        lines.append(f"**Заметки:** {phase.notes}")
    return "\n".join(lines)


def _column_id(config: dict[str, Any], column_key: str) -> int:
    columns = config.get("columns") or {}
    entry = columns.get(column_key) or {}
    col_id = entry.get("id")
    if not isinstance(col_id, int):
        raise KaitenError(f"Unknown column key: {column_key}")
    return col_id


def _find_card_on_board(
    client: KaitenClient,
    config: dict[str, Any],
    phase: FeaturePhase,
) -> dict[str, Any] | None:
    board_id = int(config["board_id"])
    board = client.get_board(board_id)
    cards = board.get("cards") or []
    external_id = f"scaning:{phase.feature_id}"
    title = _card_title(config, phase)
    for card in cards:
        if card.get("external_id") == external_id:
            return card
        if card.get("title") == title:
            return card
    return None


def _format_status_row(phase: FeaturePhase, meta: dict[str, Any]) -> str:
    card_id = meta.get("card_id", "—")
    synced = meta.get("last_synced_key", "—")
    approval = "!" if phase.awaiting_approval else " "
    return (
        f"{approval} {phase.feature_id:<22} | {phase.role:<11} | "
        f"{phase.phase[:28]:<28} | card={card_id} | sync={synced}"
    )


def status(config: dict[str, Any]) -> int:
    phases = list_pipeline_features(FEATURES_ROOT, REPO_ROOT)
    if not phases:
        print("Нет фич конвейера (нужен docs/features/<name>/plan.md)")
        return 0

    print(f"Доска: {config.get('board_title')} (id={config.get('board_id')})")
    print("-" * 100)
    for phase in phases:
        feature_dir = FEATURES_ROOT / phase.feature_id
        meta = _read_meta(feature_dir)
        print(_format_status_row(phase, meta))
    print(f"\nФич в конвейере: {len(phases)}")
    return 0


def sync_feature(
    phase: FeaturePhase,
    *,
    config: dict[str, Any],
    client: KaitenClient | None,
    dry_run: bool,
    create_missing: bool,
) -> str:
    feature_dir = FEATURES_ROOT / phase.feature_id
    meta = _read_meta(feature_dir)
    column_id = _column_id(config, phase.column_key)
    board_id = int(config["board_id"])
    lane_id = int(config["lane_id"])
    title = _card_title(config, phase)
    description = _card_description(config, phase)
    external_id = f"scaning:{phase.feature_id}"

    card_id = meta.get("card_id")
    card: dict[str, Any] | None = None

    if client is not None:
        if card_id:
            try:
                card = client.get_card(int(card_id))
            except KaitenError:
                card = None
        if card is None:
            card = _find_card_on_board(client, config, phase)

    if card is None:
        if not create_missing:
            return f"{phase.feature_id}: карточка не найдена (запустите --init)"
        if dry_run or client is None:
            return f"{phase.feature_id}: [dry-run] создать карточку «{title}» -> {phase.column_key}"
        try:
            card = client.create_card(
                title=title,
                board_id=board_id,
                column_id=column_id,
                lane_id=lane_id,
                description=description,
                external_id=external_id,
            )
        except KaitenError as exc:
            if exc.status == 403:
                return (
                    f"{phase.feature_id}: нет прав на создание карточки (403). "
                    "Выпустите API-ключ с правами записи в Kaiten."
                )
            raise
        card_id = card["id"]
        meta = {
            "card_id": card_id,
            "board_id": board_id,
            "space_id": config.get("space_id"),
            "external_id": external_id,
            "last_synced_key": phase.sync_key,
            "last_synced_at": phase.last_update,
        }
        _write_meta(feature_dir, meta)
        return f"{phase.feature_id}: создана карточка id={card_id}"

    card_id = int(card["id"])
    prev_key = str(meta.get("last_synced_key") or "")
    current_column = card.get("column_id")
    changed = prev_key != phase.sync_key or current_column != column_id

    if dry_run or client is None:
        action = "обновить" if changed else "без изменений"
        return f"{phase.feature_id}: [dry-run] {action} card={card_id} → {phase.column_key}"

    if not changed:
        if not meta.get("card_id"):
            meta.update(
                {
                    "card_id": card_id,
                    "board_id": board_id,
                    "space_id": config.get("space_id"),
                    "external_id": external_id,
                    "last_synced_key": phase.sync_key,
                    "last_synced_at": phase.last_update,
                }
            )
            _write_meta(feature_dir, meta)
        return f"{phase.feature_id}: без изменений (card={card_id})"

    try:
        client.update_card(
            card_id,
            column_id=column_id,
            title=title,
            description=description,
        )
        comment_lines = [
            f"**Scaning sync** — {phase.role}: {phase.phase}",
            f"Колонка: {phase.column_key}",
        ]
        if phase.awaiting_approval:
            comment_lines.append("Ждёт вашего approval для следующей роли.")
        client.add_comment(card_id, "\n".join(comment_lines))
    except KaitenError as exc:
        if exc.status == 403:
            return (
                f"{phase.feature_id}: нет прав на обновление (403). "
                "Ключ только для чтения — см. docs/features/kaiten-integration.md"
            )
        raise

    meta.update(
        {
            "card_id": card_id,
            "board_id": board_id,
            "space_id": config.get("space_id"),
            "external_id": external_id,
            "last_synced_key": phase.sync_key,
            "last_synced_at": phase.last_update,
        }
    )
    _write_meta(feature_dir, meta)
    col_title = (config.get("columns") or {}).get(phase.column_key, {}).get("title", phase.column_key)
    return f"{phase.feature_id}: card={card_id} -> «{col_title}» ({phase.role})"


def sync_all(
    config: dict[str, Any],
    *,
    dry_run: bool,
    create_missing: bool,
    only_feature: str | None,
) -> int:
    phases = list_pipeline_features(FEATURES_ROOT, REPO_ROOT)
    if only_feature:
        phases = [p for p in phases if p.feature_id == only_feature]
        if not phases:
            print(f"Фича не найдена или без plan.md: {only_feature}", file=sys.stderr)
            return 1

    client: KaitenClient | None = None
    if not dry_run:
        try:
            client = KaitenClient.from_env(config)
        except KaitenError as exc:
            if create_missing:
                print(str(exc), file=sys.stderr)
                return 1

    errors = 0
    for phase in phases:
        try:
            message = sync_feature(
                phase,
                config=config,
                client=client,
                dry_run=dry_run,
                create_missing=create_missing,
            )
            print(message)
            if "403" in message or "не задан" in message.lower():
                errors += 1
        except KaitenError as exc:
            print(f"{phase.feature_id}: ERROR {exc}", file=sys.stderr)
            errors += 1

    return 1 if errors else 0


def link_card(feature_id: str, card_id: int, config: dict[str, Any]) -> int:
    feature_dir = FEATURES_ROOT / feature_id
    if not (feature_dir / "plan.md").is_file():
        print(f"Нет plan.md: {feature_dir}", file=sys.stderr)
        return 1
    meta = {
        "card_id": card_id,
        "board_id": config.get("board_id"),
        "space_id": config.get("space_id"),
        "external_id": f"scaning:{feature_id}",
        "linked_manually": True,
    }
    _write_meta(feature_dir, meta)
    print(f"{feature_id}: привязана карточка id={card_id} (ручная)")
    return 0


def print_manual_instructions(config: dict[str, Any]) -> int:
    phases = list_pipeline_features(FEATURES_ROOT, REPO_ROOT)
    if not phases:
        print("Нет фич конвейера.")
        return 0
    board = config.get("board_title", "Задачи")
    print(f"Создайте на доске «{board}» карточки вручную, затем привяжите:")
    print()
    for phase in phases:
        title = _card_title(config, phase)
        col = (config.get("columns") or {}).get(phase.column_key, {}).get("title", phase.column_key)
        print(f"- {title}")
        print(f"  Колонка: {col}")
        print(f"  Описание: {_card_description(config, phase).replace(chr(10), ' / ')}")
        print(f"  Привязка: python scripts/sync-kaiten-features.py --link-card {phase.feature_id} <CARD_ID>")
        print()
    return 0


def _load_tasks_registry() -> dict[str, Any]:
    if not TASKS_REGISTRY_PATH.is_file():
        return {"tasks": {}}
    return json.loads(TASKS_REGISTRY_PATH.read_text(encoding="utf-8"))


def _save_tasks_registry(data: dict[str, Any]) -> None:
    TASKS_REGISTRY_PATH.parent.mkdir(parents=True, exist_ok=True)
    TASKS_REGISTRY_PATH.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def _board_cards_by_external_id(client: KaitenClient, board_id: int) -> dict[str, dict[str, Any]]:
    board = client.get_board(board_id)
    result: dict[str, dict[str, Any]] = {}
    for card in board.get("cards") or []:
        ext = card.get("external_id")
        if ext:
            result[str(ext)] = card
    return result


def _import_feature_cards_into_registry(registry: dict[str, Any]) -> None:
    tasks = registry.setdefault("tasks", {})
    for feature_dir in FEATURES_ROOT.iterdir():
        if not feature_dir.is_dir():
            continue
        meta_path = feature_dir / KAITEN_META
        if not meta_path.is_file():
            continue
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        card_id = meta.get("card_id")
        if not card_id:
            continue
        key = f"pipeline-{feature_dir.name}"
        tasks[key] = {
            "card_id": card_id,
            "board_id": meta.get("board_id"),
            "external_id": meta.get("external_id") or f"scaning:{feature_dir.name}",
            "linked_from": str(meta_path.as_posix()),
        }


def export_all_tasks(config: dict[str, Any], *, dry_run: bool = False) -> int:
    prefix = str(config.get("card_title_prefix") or "[Scaning]").strip()
    board_id = int(config["board_id"])
    lane_id = int(config["lane_id"])
    tasks_list = collect_all_tasks(FEATURES_ROOT, REPO_ROOT)

    registry = _load_tasks_registry()
    _import_feature_cards_into_registry(registry)
    reg_tasks: dict[str, Any] = registry.setdefault("tasks", {})

    skip_pipeline: set[str] = set()
    for feature_dir in FEATURES_ROOT.iterdir():
        if (feature_dir / KAITEN_META).is_file():
            skip_pipeline.add(f"pipeline-{feature_dir.name}")

    client: KaitenClient | None = None
    board_index: dict[str, dict[str, Any]] = {}
    if not dry_run:
        client = KaitenClient.from_env(config)
        board_index = _board_cards_by_external_id(client, board_id)

    created = updated = skipped = errors = 0

    for task in tasks_list:
        if task.task_id in skip_pipeline:
            skipped += 1
            continue

        external_id = f"scaning:task:{task.task_id}"
        title = task_card_title(prefix, task)
        description = task_card_description(task)
        column_id = _column_id(config, task.column_key)
        entry = reg_tasks.get(task.task_id) or {}
        card_id = entry.get("card_id")

        card = board_index.get(external_id)
        if card is None and card_id:
            try:
                assert client is not None
                card = client.get_card(int(card_id))
            except KaitenError:
                card = None

        if dry_run or client is None:
            action = "create" if not card_id and not card else "update"
            col = (config.get("columns") or {}).get(task.column_key, {}).get("title", task.column_key)
            print(f"[dry-run] {action} {task.task_id} -> {col}: {title}")
            continue

        try:
            if card is None:
                card = client.create_card(
                    title=title,
                    board_id=board_id,
                    column_id=column_id,
                    lane_id=lane_id,
                    description=description,
                    external_id=external_id,
                )
                card_id = int(card["id"])
                reg_tasks[task.task_id] = {
                    "card_id": card_id,
                    "board_id": board_id,
                    "external_id": external_id,
                    "column_key": task.column_key,
                }
                board_index[external_id] = card
                created += 1
                print(f"+ {task.task_id}: card={card_id} ({task.column_key})")
            else:
                card_id = int(card["id"])
                needs_move = card.get("column_id") != column_id
                needs_meta = entry.get("column_key") != task.column_key
                if needs_move or needs_meta:
                    client.update_card(
                        card_id,
                        column_id=column_id,
                        title=title,
                        description=description,
                    )
                    updated += 1
                    print(f"~ {task.task_id}: card={card_id} -> {task.column_key}")
                else:
                    skipped += 1
                reg_tasks[task.task_id] = {
                    "card_id": card_id,
                    "board_id": board_id,
                    "external_id": external_id,
                    "column_key": task.column_key,
                }
            time.sleep(0.22)
        except KaitenError as exc:
            errors += 1
            print(f"! {task.task_id}: ERROR {exc}", file=sys.stderr)

    if not dry_run:
        _save_tasks_registry(registry)

    print(
        f"\nИтого: создано {created}, обновлено {updated}, "
        f"без изменений {skipped}, ошибок {errors}, задач {len(tasks_list)}"
    )
    return 1 if errors else 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Синхронизация фич Scaning (конвейер оркестрации) с Kaiten"
    )
    parser.add_argument(
        "--status",
        action="store_true",
        help="Показать фазы без вызова API",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Показать план синхронизации без записи в Kaiten",
    )
    parser.add_argument(
        "--init",
        action="store_true",
        help="Создать карточки для фич без kaiten.json",
    )
    parser.add_argument(
        "--feature",
        metavar="NAME",
        help="Только одна фича (имя папки в docs/features)",
    )
    parser.add_argument(
        "--link-card",
        nargs=2,
        metavar=("FEATURE", "CARD_ID"),
        help="Привязать существующую карточку Kaiten (если API не пишет)",
    )
    parser.add_argument(
        "--print-manual",
        action="store_true",
        help="Шаблоны карточек для ручного создания в UI",
    )
    parser.add_argument(
        "--export-all",
        action="store_true",
        help="Выгрузить все задачи проекта на доску Kaiten",
    )
    args = parser.parse_args()

    _load_dotenv()
    try:
        config = _load_config()
    except KaitenError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    if args.status:
        return status(config)

    if args.print_manual:
        return print_manual_instructions(config)

    if args.link_card:
        feature_id, raw_id = args.link_card
        try:
            card_id = int(raw_id)
        except ValueError:
            print(f"CARD_ID должен быть числом: {raw_id}", file=sys.stderr)
            return 1
        return link_card(feature_id, card_id, config)

    if args.export_all:
        return export_all_tasks(config, dry_run=args.dry_run)

    return sync_all(
        config,
        dry_run=args.dry_run,
        create_missing=args.init or True,
        only_feature=args.feature,
    )


if __name__ == "__main__":
    raise SystemExit(main())
