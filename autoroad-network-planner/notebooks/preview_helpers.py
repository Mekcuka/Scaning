"""Общий bootstrap для autoroad_network_preview.ipynb (импорт из любой ячейки)."""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any


def setup_package_root() -> Path:
    """Корень пакета autoroad-network-planner + notebooks/ в sys.path."""
    candidates = [Path.cwd(), Path.cwd().parent, Path.cwd().parent.parent]
    for root in candidates:
        if not (root / "autoroad_planner").is_dir():
            continue
        if str(root) not in sys.path:
            sys.path.insert(0, str(root))
        nb = root / "notebooks"
        if nb.is_dir() and str(nb) not in sys.path:
            sys.path.insert(0, str(nb))
        return root
    raise RuntimeError(
        "Не найден каталог autoroad_planner. "
        "Откройте Jupyter с cwd = autoroad-network-planner (или notebooks/)."
    )


def ensure_plan_context(globals_dict: dict[str, Any] | None = None) -> tuple[Any, Any, Any, Path]:
    """Возвращает (req, out, terminals, ROOT); подгружает из data/gks12_*.json при необходимости."""
    g = globals_dict if globals_dict is not None else globals()
    root = setup_package_root()

    from autoroad_planner.schemas import NetworkPlanRequest, NetworkPlanResponse

    out = g.get("out")
    terminals = g.get("terminals")
    req = g.get("req")

    if out is not None and terminals is not None:
        if req is None:
            req = type("_ReqFallback", (), {"existing_autoroads": []})()
        g.update(ROOT=root, req=req, out=out, terminals=terminals)
        return req, out, terminals, root

    resp_path = root / "data" / "gks12_response.json"
    req_path = root / "data" / "gks12_request.json"
    if not resp_path.is_file():
        raise RuntimeError(
            f"Нет out в памяти и нет {resp_path}. Выполните ячейку расчёта (GKS_RAW)."
        )
    out = NetworkPlanResponse.model_validate_json(resp_path.read_text(encoding="utf-8"))
    if req_path.is_file():
        req = NetworkPlanRequest.model_validate_json(req_path.read_text(encoding="utf-8"))
        terminals = req.terminals
    else:
        terminals = out.terminals
        req = type("_ReqFallback", (), {"existing_autoroads": []})()
    print("загружено из JSON:", resp_path.name)

    g.update(ROOT=root, req=req, out=out, terminals=terminals)
    return req, out, terminals, root
