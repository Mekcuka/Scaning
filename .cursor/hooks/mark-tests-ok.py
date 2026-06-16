#!/usr/bin/env python3
"""Утилита: отметить, что тесты прошли зелёно.

Запускается вручную после успешного `pytest tests/ -q` и `npm run test`:
    python .cursor/hooks/mark-tests-ok.py

Создаёт маркер, который gate-push-tests.py считает «свежим тест-прогоном».
Это снимает блокировку push.
"""
import os
import sys
import time


def main():
    state_dir = os.path.join(os.getcwd(), ".cursor", "hooks", "state")
    os.makedirs(state_dir, exist_ok=True)
    marker = os.path.join(state_dir, "last_tests_ok.marker")
    with open(marker, "w", encoding="utf-8") as f:
        f.write(str(time.time()))
    print(f"Маркер создан: {marker}")
    print("Push-гейт (gate-push-tests.py) теперь разрешит push, если нет новых правок кода.")


if __name__ == "__main__":
    main()
