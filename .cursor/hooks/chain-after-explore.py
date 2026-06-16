#!/usr/bin/env python3
"""Chain: после explore-сабажента напоминает Planner создать артефакты.

Срабатывает на subagentStop с matcher "explore". loop_limit=1.
Если Planner ещё не создал plan.md — напоминает об обязательных артефактах.
"""
import json
import sys
import os
import glob


def find_feature_dirs():
    """Ищет директории docs/features/* на предмет свежих plan.md."""
    features_dir = os.path.join(os.getcwd(), "docs", "features")
    if not os.path.isdir(features_dir):
        return []
    return [d for d in glob.glob(os.path.join(features_dir, "*")) if os.path.isdir(d)]


def parse_hook_input():
    try:
        data = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        return {}
    return data


def main():
    data = parse_hook_input()

    # Проверяем, есть ли в выводе explore признаки планирования фичи
    text = json.dumps(data).lower() if data else ""
    looks_like_planning = any(kw in text for kw in (
        "feature", "plan", "integration", "микросервис", "фича", "интеграц",
        "контракт", "api", "endpoint", "port", "808",
    ))

    if not looks_like_planning:
        # Обычный explore — не вмешиваемся
        print(json.dumps({}))
        sys.exit(0)

    # Проверяем, создан ли plan.md в какой-либо feature-директории
    feature_dirs = find_feature_dirs()
    has_recent_plan = False
    for d in feature_dirs:
        plan = os.path.join(d, "plan.md")
        contract = os.path.join(d, "contract.md")
        if os.path.exists(plan) and os.path.exists(contract):
            has_recent_plan = True
            break

    if has_recent_plan:
        print(json.dumps({}))
        sys.exit(0)

    # Planner ещё не создал артефакты — напоминаем
    print(json.dumps({
        "followup_message": (
            "Explore завершён. Planner: создайте обязательные артефакты перед handoff к Builder:\n"
            "- docs/features/<feature>/plan.md (scope, фазы, стек, критерии готовности)\n"
            "- docs/features/<feature>/contract.md (OpenAPI request/response)\n"
            "- docs/features/<feature>/data-model.md (поля, миграции)\n\n"
            "Без этих файлов Builder не имеет мандата стартовать. "
            "См. skill: feature-planner."
        ),
    }))
    sys.exit(0)


if __name__ == "__main__":
    main()
