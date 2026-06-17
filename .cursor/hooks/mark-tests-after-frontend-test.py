#!/usr/bin/env python3
"""После успешного npm run test во frontend — обновляет last_tests_ok.marker."""
import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hook_state import touch_tests_ok


def main() -> None:
    try:
        data = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        data = {}

    command = str(data.get("command") or data.get("cmd") or "")
    exit_code = data.get("exit_code", data.get("exitCode", 1))
    norm = command.replace("\\", "/")

    is_frontend_test = (
        "decision-matrix/frontend" in norm or "frontend" in norm.lower()
    ) and "npm run test" in norm

    if is_frontend_test and exit_code == 0:
        touch_tests_ok()

    print(json.dumps({}))
    sys.exit(0)


if __name__ == "__main__":
    main()
