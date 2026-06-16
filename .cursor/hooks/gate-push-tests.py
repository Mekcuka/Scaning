#!/usr/bin/env python3
"""Гейт: блокирует `git push` если pytest/npm test не запускались после правок кода.

Жёсткий гейт (failClosed: true). Читает JSON из stdin, проверяет маркер последнего
тест-прогона. Если маркер устарел или отсутствует — block.
"""
import json
import sys
import os
import time

HOOK_STATE_DIR = os.path.join(os.getcwd(), ".cursor", "hooks", "state")
MARKER_FILE = os.path.join(HOOK_STATE_DIR, "last_tests_ok.marker")
CODE_DIRS = ("decision-matrix/backend/app", "decision-matrix/frontend/src")
MAX_AGE_SECONDS = 3600  # 1 час — тест-прогон считается свежим


def allow(msg: str = "") -> None:
    out = {"permission": "allow"}
    if msg:
        out["agent_message"] = msg
    print(json.dumps(out))
    sys.exit(0)


def block(user_msg: str, agent_msg: str) -> None:
    print(json.dumps({
        "permission": "deny",
        "user_message": user_msg,
        "agent_message": agent_msg,
    }))
    sys.exit(0)


def find_recent_code_change() -> bool:
    """Возвращает True, если есть файл в CODE_DIRS, изменённый позже маркера."""
    marker_mtime = 0.0
    if os.path.exists(MARKER_FILE):
        marker_mtime = os.path.getmtime(MARKER_FILE)

    now = time.time()
    for code_dir in CODE_DIRS:
        if not os.path.isdir(code_dir):
            continue
        for root, _dirs, files in os.walk(code_dir):
            # пропускаем node_modules, venv, __pycache__
            if any(skip in root for skip in ("node_modules", "venv", "__pycache__", ".vite")):
                continue
            for f in files:
                if not f.endswith((".py", ".ts", ".tsx", ".css")):
                    continue
                path = os.path.join(root, f)
                try:
                    if os.path.getmtime(path) > marker_mtime:
                        return True
                except OSError:
                    continue
    return False


def main() -> None:
    # Читаем stdin (JSON hook input)
    try:
        _data = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        _data = {}

    os.makedirs(HOOK_STATE_DIR, exist_ok=True)

    # Если маркер старее MAX_AGE_SECONDS или отсутствует
    marker_exists = os.path.exists(MARKER_FILE)
    marker_fresh = False
    if marker_exists:
        age = time.time() - os.path.getmtime(MARKER_FILE)
        marker_fresh = age < MAX_AGE_SECONDS

    has_recent_changes = find_recent_code_change()

    if marker_fresh and not has_recent_changes:
        allow("Push разрешён: тесты свежие.")

    if not marker_exists or not marker_fresh or has_recent_changes:
        block(
            "Push заблокирован: прогоните тесты перед push.",
            "Жёсткий гейт: после правок кода нужно запустить pytest и npm run test. "
            "Команды: `cd decision-matrix/backend && pytest tests/ -q` и "
            "`cd decision-matrix/frontend && npm run test`. "
            "После зелёного прогона повторите push. "
            "См. правило .cursor/rules/pre-deploy-ci.mdc."
        )


if __name__ == "__main__":
    main()
