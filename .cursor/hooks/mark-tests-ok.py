#!/usr/bin/env python3
"""Утилита: отметить, что тесты прошли зелёно.

Запускается вручную после успешного `pytest tests/ -q` и `npm run test`:
    python .cursor/hooks/mark-tests-ok.py

Создаёт маркер, который gate-push-tests.py считает «свежим тест-прогоном».
Это снимает блокировку push и напоминание remind-tests-if-frontend.py.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hook_state import TESTS_OK_MARKER, touch_tests_ok


def main():
    touch_tests_ok()
    print(f"Маркер создан: {TESTS_OK_MARKER}")
    print("Push-гейт и remind-tests-if-frontend.py учитывают этот прогон.")


if __name__ == "__main__":
    main()
