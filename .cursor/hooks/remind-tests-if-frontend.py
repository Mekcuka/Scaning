#!/usr/bin/env python3
"""Remind: если агент менял frontend, но не запускал тесты — напоминает перед завершением.

Срабатывает на stop (агент завершил turn). loop_limit=1.
Проверяет маркер свежих правок в frontend/src и отсутствие свежего тест-прогона.
"""
import json
import sys
import os
import time


STATE_DIR = os.path.join(os.getcwd(), ".cursor", "hooks", "state")
FRONTEND_SRC = os.path.join(os.getcwd(), "decision-matrix", "frontend", "src")
MAX_RELEVANT_AGE = 1800  # 30 минут — правка считается «недавней»


def parse_hook_input():
    try:
        data = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        return {}
    return data


def has_recent_frontend_edit():
    if not os.path.isdir(FRONTEND_SRC):
        return False
    now = time.time()
    for root, _dirs, files in os.walk(FRONTEND_SRC):
        if "node_modules" in root or ".vite" in root:
            continue
        for f in files:
            if not f.endswith((".ts", ".tsx", ".css")):
                continue
            path = os.path.join(root, f)
            try:
                if now - os.path.getmtime(path) < MAX_RELEVANT_AGE:
                    return True
            except OSError:
                continue
    return False


def main():
    data = parse_hook_input()
    _ = data  # не используем, но читаем для корректного потока

    if not has_recent_frontend_edit():
        print(json.dumps({}))
        sys.exit(0)

    # Есть недавние правки frontend — напоминаем прогнать тесты
    print(json.dumps({
        "followup_message": (
            "Обнаружены недавние правки в decision-matrix/frontend/src. "
            "Перед завершением задачи прогоните:\n"
            "  cd decision-matrix/frontend && npm run lint && npm run test\n"
            "Если переходите к фазе Reviewer — тесты обязательны."
        ),
    }))
    sys.exit(0)


if __name__ == "__main__":
    main()
