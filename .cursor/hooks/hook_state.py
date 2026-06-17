"""Общие пути и маркеры для hook-гейтов тестов."""
import os
import time

STATE_DIR = os.path.join(os.getcwd(), ".cursor", "hooks", "state")
TESTS_OK_MARKER = os.path.join(STATE_DIR, "last_tests_ok.marker")
FRONTEND_TOUCHED_MARKER = os.path.join(STATE_DIR, "frontend_touched.marker")


def ensure_state_dir() -> None:
    os.makedirs(STATE_DIR, exist_ok=True)


def touch_marker(path: str) -> None:
    ensure_state_dir()
    with open(path, "w", encoding="utf-8") as f:
        f.write(str(time.time()))


def touch_frontend_touched() -> None:
    touch_marker(FRONTEND_TOUCHED_MARKER)


def touch_tests_ok() -> None:
    touch_marker(TESTS_OK_MARKER)


def marker_mtime(path: str) -> float:
    if not os.path.exists(path):
        return 0.0
    return os.path.getmtime(path)


def frontend_needs_test_reminder() -> bool:
    """True только если в сессии правили frontend и тесты не прогонялись после этого."""
    if not os.path.exists(FRONTEND_TOUCHED_MARKER):
        return False
    return marker_mtime(FRONTEND_TOUCHED_MARKER) > marker_mtime(TESTS_OK_MARKER)
