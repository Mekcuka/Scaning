#!/usr/bin/env python3
"""Напоминание прогнать frontend-тесты — только после правок FE в текущей сессии.

Срабатывает на stop, если afterFileEdit отметил frontend_touched.marker позже,
чем last_tests_ok.marker (см. mark-tests-ok.py / успешный npm run test).

Не срабатывает на вопросы, деплой, dashboard и т.п. без правок frontend/src.
"""
import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hook_state import frontend_needs_test_reminder


def main() -> None:
    try:
        json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        pass

    if not frontend_needs_test_reminder():
        print(json.dumps({}))
        sys.exit(0)

    print(json.dumps({
        "followup_message": (
            "В этой сессии менялся decision-matrix/frontend/src, но после правок "
            "не зафиксирован прогон тестов.\n"
            "Перед handoff Reviewer, push или завершением FE-задачи выполните:\n"
            "  cd decision-matrix/frontend && npm run lint && npm run test\n"
            "  python .cursor/hooks/mark-tests-ok.py\n"
            "(mark-tests-ok — после зелёного lint+test; иначе push-гейт заблокирует push.)"
        ),
    }))
    sys.exit(0)


if __name__ == "__main__":
    main()
