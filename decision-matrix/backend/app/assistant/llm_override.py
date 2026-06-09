"""In-memory LLM config override (admin, no restart)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.core.config import settings


@dataclass(slots=True)
class LlmEffectiveConfig:
    base_url: str
    api_key: str
    model: str


_override: dict[str, str] = {}


def get_effective_llm_config() -> LlmEffectiveConfig:
    base_url = _override.get("base_url") or settings.ASSISTANT_LLM_BASE_URL
    api_key = _override.get("api_key") or settings.ASSISTANT_LLM_API_KEY
    model = _override.get("model") or settings.ASSISTANT_LLM_MODEL
    return LlmEffectiveConfig(base_url=base_url, api_key=api_key, model=model)


def apply_llm_override(data: dict[str, Any]) -> dict[str, str | None]:
    applied: dict[str, str | None] = {}
    for key in ("base_url", "model", "api_key"):
        if key in data and data[key] is not None:
            value = str(data[key]).strip()
            if value:
                _override[key] = value
                applied[key] = value
            elif key in _override:
                del _override[key]
                applied[key] = None
    return applied


def clear_llm_override() -> None:
    _override.clear()


def llm_override_snapshot() -> dict[str, str]:
    return dict(_override)
