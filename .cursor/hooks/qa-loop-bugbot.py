#!/usr/bin/env python3
"""QA-loop: после bugbot возвращает findings к Builder для исправления.

Срабатывает на subagentStop с matcher "bugbot". Если bugbot вернул findings —
отправляет followup_message к Builder с конкретными замечаниями.
loop_limit=2: не больше двух итераций, дальше — человек.
"""
import json
import sys
import os

STATE_DIR = os.path.join(os.getcwd(), ".cursor", "hooks", "state")
LOOP_COUNTER = os.path.join(STATE_DIR, "bugbot_loop.counter")
MAX_LOOP = 2


def parse_hook_input():
    try:
        data = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        return {}
    return data


def extract_findings(data):
    """Пытается найти findings в выводе subagent."""
    text = ""
    if isinstance(data, dict):
        # subagentStop payload может содержать result/output
        for key in ("output", "result", "response", "message", "content"):
            val = data.get(key)
            if isinstance(val, str) and val:
                text += "\n" + val
            elif isinstance(val, dict):
                text += "\n" + json.dumps(val)
    # Эвристика: bugbot обычно пишет "finding", "issue", "severity", "bug"
    markers = ("finding", "issue:", "severity:", "bug:", "recommendation:", "fix:")
    has_findings = any(m in text.lower() for m in markers)
    # Также считаем findings если текст длинный и не содержит "no issues"/"clean"
    if "no issue" in text.lower() or "no finding" in text.lower() or "clean" in text.lower():
        return False, ""
    return has_findings or len(text.strip()) > 200, text


def get_counter():
    os.makedirs(STATE_DIR, exist_ok=True)
    try:
        with open(LOOP_COUNTER, "r", encoding="utf-8") as f:
            return int(f.read().strip() or "0")
    except (FileNotFoundError, ValueError):
        return 0


def bump_counter():
    os.makedirs(STATE_DIR, exist_ok=True)
    c = get_counter() + 1
    with open(LOOP_COUNTER, "w", encoding="utf-8") as f:
        f.write(str(c))


def reset_counter():
    os.makedirs(STATE_DIR, exist_ok=True)
    with open(LOOP_COUNTER, "w", encoding="utf-8") as f:
        f.write("0")


def main():
    data = parse_hook_input()
    has_findings, text = extract_findings(data)

    if not has_findings:
        # Зелёно — сбрасываем счётчик
        reset_counter()
        # Ничего не возвращаем — цикл не продолжается
        print(json.dumps({}))
        sys.exit(0)

    counter = get_counter()
    if counter >= MAX_LOOP:
        # Лимит итераций — эскалация к человеку
        reset_counter()
        print(json.dumps({
            "followup_message": (
                "Bugbot вернул замечания после 2 итераций исправлений. "
                "Лимит автоматического цикла исчерпан — требуется ручное ревью. "
                f"Findings:\n{text[:1500]}"
            ),
        }))
        sys.exit(0)

    bump_counter()
    print(json.dumps({
        "followup_message": (
            f"QA-loop итерация {counter + 1}/{MAX_LOOP}. Bugbot нашёл замечания. "
            "Builder: исправь следующие находки и вернись на ревью:\n"
            f"{text[:2000]}"
        ),
    }))
    sys.exit(0)


if __name__ == "__main__":
    main()
