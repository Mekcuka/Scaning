#!/usr/bin/env python3
"""Запускает `npm run lint` на frontend-файлах после редактирования.

Мягкий гейт (failClosed: false): если lint находит ошибки — сообщает агенту,
но не блокирует инструмент. Срабатывает только на .ts/.tsx/.css файлах в frontend/src.
"""
import json
import sys
import os
import subprocess


def parse_hook_input():
    try:
        data = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        return {}
    return data


def get_edited_path(data):
    # Cursor beforeFileEdit/afterFileEdit передаёт путь в разных полях
    for key in ("path", "file_path", "filePath", "tool_input", "input"):
        val = data
        for part in str(key).split("."):
            if isinstance(val, dict):
                val = val.get(part)
            else:
                val = None
                break
        if isinstance(val, str) and val:
            return val
    # Если есть вложенный tool_input.path
    ti = data.get("tool_input") if isinstance(data, dict) else None
    if isinstance(ti, dict):
        for k in ("path", "file_path", "filePath"):
            v = ti.get(k)
            if isinstance(v, str) and v:
                return v
    return ""


def is_frontend_file(path: str) -> bool:
    norm = path.replace("\\", "/")
    return ("decision-matrix/frontend/src" in norm) and norm.endswith((".ts", ".tsx", ".css", ".js", ".jsx"))


def run_lint(file_path: str):
    frontend_dir = os.path.join(os.getcwd(), "decision-matrix", "frontend")
    if not os.path.isdir(frontend_dir):
        return None, "frontend dir not found"
    try:
        result = subprocess.run(
            ["npm", "run", "lint", "--", file_path],
            cwd=frontend_dir,
            capture_output=True,
            text=True,
            timeout=45,
            shell=True,
        )
        return result, None
    except (subprocess.TimeoutExpired, FileNotFoundError) as e:
        return None, str(e)


def main():
    data = parse_hook_input()
    edited = get_edited_path(data)

    if not edited or not is_frontend_file(edited):
        # Разрешаем — не наш файл
        print(json.dumps({"permission": "allow"}))
        sys.exit(0)

    result, err = run_lint(edited)
    if err:
        # Мягкий гейт — не блокируем при ошибке запуска
        print(json.dumps({
            "permission": "allow",
            "agent_message": f"Lint не запущен ({err}). Проверьте вручную: npm run lint -- {edited}",
        }))
        sys.exit(0)

    if result.returncode == 0:
        print(json.dumps({"permission": "allow"}))
        sys.exit(0)

    # Lint ошибки — сообщаем, но не блокируем (failClosed: false)
    stderr_snippet = (result.stderr or "")[-500:]
    stdout_snippet = (result.stdout or "")[-500:]
    print(json.dumps({
        "permission": "allow",
        "agent_message": (
            f"ESLint нашёл ошибки в {edited}. Исправьте перед следующим шагом:\n"
            f"{stdout_snippet}\n{stderr_snippet}"
        ),
        "user_message": f"Lint ошибки в {edited} — см. вывод.",
    }))
    sys.exit(0)


if __name__ == "__main__":
    main()
