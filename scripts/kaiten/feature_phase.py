"""Detect orchestration pipeline phase from docs/features artifacts."""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Literal

Role = Literal["Planner", "Builder", "Reviewer", "Integrator", "Done"]
Verdict = Literal["none", "green", "red"]
ColumnKey = Literal["queue", "in_progress", "done"]

_H1_RE = re.compile(r"^#\s+(.+)$", re.MULTILINE)
_CI_SUCCESS_RE = re.compile(r"ci\s*(success|green|зел)", re.IGNORECASE)
_MIGRATION_RE = re.compile(r"миграц|docker|alembic|compose", re.IGNORECASE)
_APPROVAL_RE = re.compile(
    r"переходим к (builder|reviewer|integrator)\??|ждёт integrator|deploy ready",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class FeaturePhase:
    feature_id: str
    name: str
    role: Role
    phase: str
    awaiting_approval: bool
    verdict: Verdict
    column_key: ColumnKey
    sync_key: str
    doc_path: str
    last_update: str
    notes: str


def _read_text(path: Path) -> str:
    if not path.is_file():
        return ""
    return path.read_text(encoding="utf-8")


def _first_h1(text: str, fallback: str) -> str:
    match = _H1_RE.search(text)
    if not match:
        return fallback
    title = match.group(1).strip()
    title = re.sub(r"^план:\s*", "", title, flags=re.IGNORECASE)
    title = re.sub(r"^review report:\s*", "", title, flags=re.IGNORECASE)
    return title


def _verdict(text: str) -> Verdict:
    normalized = text.replace("Ё", "Е").replace("ё", "е")
    for line in normalized.splitlines():
        lower = line.lower()
        if "вердикт" not in lower:
            continue
        if "крас" in lower:
            return "red"
        if "зел" in lower:
            return "green"
    return "none"


def _last_update(feature_dir: Path) -> str:
    latest: float = 0.0
    for path in feature_dir.glob("*.md"):
        mtime = path.stat().st_mtime
        if mtime > latest:
            latest = mtime
    if latest <= 0:
        return date.today().isoformat()
    return date.fromtimestamp(latest).isoformat()


def _builder_phase(impl_log: str) -> str:
    if not impl_log.strip():
        return "Реализация"
    sections = re.findall(r"^##\s+(.+)$", impl_log, re.MULTILINE)
    if sections:
        return sections[-1].strip()
    return "Реализация"


def _role_to_column(role: Role) -> ColumnKey:
    if role == "Done":
        return "done"
    if role == "Planner":
        return "queue"
    return "in_progress"


def detect_feature_phase(
    feature_dir: Path,
    *,
    bugbot_loop: int = 0,
) -> FeaturePhase | None:
    """Return phase for pipeline features (must have plan.md)."""
    plan_path = feature_dir / "plan.md"
    if not plan_path.is_file():
        return None

    feature_id = feature_dir.name
    plan_text = _read_text(plan_path)
    contract_path = feature_dir / "contract.md"
    impl_path = feature_dir / "impl-log.md"
    review_path = feature_dir / "review-report.md"
    integration_path = feature_dir / "integration-log.md"

    contract_text = _read_text(contract_path)
    impl_text = _read_text(impl_path)
    review_text = _read_text(review_path)
    integration_text = _read_text(integration_path)

    name = _first_h1(plan_text, feature_id)
    verdict = _verdict(review_text)
    role: Role = "Planner"
    phase = "Артефакты планирования"
    awaiting = False
    notes = ""

    if contract_path.is_file():
        if not impl_path.is_file():
            role = "Planner"
            phase = "Готов к handoff Builder"
            awaiting = True
            notes = "Ждёт approval → Builder"
        elif not review_path.is_file():
            role = "Builder"
            phase = _builder_phase(impl_text)
            if _APPROVAL_RE.search(impl_text):
                awaiting = True
                notes = "Ждёт approval → Reviewer"
        elif verdict != "green":
            role = "Reviewer"
            phase = "Review (вердикт не зелёный)"
            notes = "Возврат к Builder возможен"
        elif not integration_path.is_file() and not _MIGRATION_RE.search(review_text):
            role = "Reviewer"
            phase = "Ждёт Integrator"
            awaiting = True
            notes = "Ждёт approval → Integrator"
        elif integration_path.is_file() and _CI_SUCCESS_RE.search(integration_text):
            role = "Done"
            phase = "Завершено"
            notes = "CI success"
        elif integration_path.is_file() or _MIGRATION_RE.search(review_text):
            role = "Integrator"
            phase = "Интеграция"
            if "deploy ready" in integration_text.lower() and not _CI_SUCCESS_RE.search(
                integration_text
            ):
                awaiting = True
                notes = "Ждёт CI success"
        else:
            role = "Integrator"
            phase = "Интеграция"
    else:
        role = "Planner"
        phase = "Пишу контракт"

    if bugbot_loop > 0 and role in ("Builder", "Reviewer"):
        notes = f"Bugbot loop {bugbot_loop}/2"
        if notes and phase:
            phase = f"{phase} ({notes})"

    column_key = _role_to_column(role)
    sync_key = f"{role}|{phase}|{awaiting}|{verdict}|{bugbot_loop}"

    return FeaturePhase(
        feature_id=feature_id,
        name=name,
        role=role,
        phase=phase,
        awaiting_approval=awaiting,
        verdict=verdict,
        column_key=column_key,
        sync_key=sync_key,
        doc_path=str(plan_path.as_posix()),
        last_update=_last_update(feature_dir),
        notes=notes,
    )


def list_pipeline_features(features_root: Path, repo_root: Path) -> list[FeaturePhase]:
    bugbot_loop = 0
    counter = repo_root / ".cursor" / "hooks" / "state" / "bugbot_loop.counter"
    if counter.is_file():
        try:
            bugbot_loop = int(counter.read_text(encoding="utf-8").strip() or "0")
        except ValueError:
            bugbot_loop = 0

    phases: list[FeaturePhase] = []
    if not features_root.is_dir():
        return phases

    for feature_dir in sorted(features_root.iterdir()):
        if not feature_dir.is_dir():
            continue
        phase = detect_feature_phase(feature_dir, bugbot_loop=bugbot_loop)
        if phase is not None:
            phases.append(phase)
    return phases
