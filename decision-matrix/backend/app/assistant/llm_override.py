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
    max_tokens: int
    timeout_seconds: int


@dataclass(slots=True)
class EmbeddingEffectiveConfig:
    base_url: str
    api_key: str
    model: str


_override: dict[str, str] = {}

_CHAT_KEYS = ("base_url", "model", "api_key", "max_tokens", "timeout_seconds")
_EMBEDDING_KEYS = ("embedding_base_url", "embedding_api_key", "embedding_model")
_ALL_OVERRIDE_KEYS = _CHAT_KEYS + _EMBEDDING_KEYS


def _int_override(key: str, default: int) -> int:
    raw = _override.get(key)
    if raw is None or not str(raw).strip():
        return default
    try:
        return int(str(raw).strip())
    except ValueError:
        return default


def get_effective_llm_config() -> LlmEffectiveConfig:
    base_url = _override.get("base_url") or settings.ASSISTANT_LLM_BASE_URL
    api_key = _override.get("api_key") or settings.ASSISTANT_LLM_API_KEY
    model = _override.get("model") or settings.ASSISTANT_LLM_MODEL
    return LlmEffectiveConfig(
        base_url=base_url,
        api_key=api_key,
        model=model,
        max_tokens=_int_override("max_tokens", settings.ASSISTANT_LLM_MAX_TOKENS),
        timeout_seconds=_int_override("timeout_seconds", settings.ASSISTANT_LLM_TIMEOUT_SECONDS),
    )


def get_effective_embedding_config() -> EmbeddingEffectiveConfig:
    chat = get_effective_llm_config()
    base_url = (
        _override.get("embedding_base_url")
        or settings.ASSISTANT_WIKI_EMBEDDING_BASE_URL.strip()
        or chat.base_url
    )
    api_key = (
        _override.get("embedding_api_key")
        or settings.ASSISTANT_WIKI_EMBEDDING_API_KEY
        or chat.api_key
    )
    model = (
        _override.get("embedding_model")
        or settings.ASSISTANT_WIKI_EMBEDDING_MODEL.strip()
        or "text-embedding-3-small"
    )
    return EmbeddingEffectiveConfig(base_url=base_url, api_key=api_key, model=model)


def apply_llm_override(data: dict[str, Any]) -> dict[str, str | None]:
    applied: dict[str, str | None] = {}
    for key in _ALL_OVERRIDE_KEYS:
        if key not in data or data[key] is None:
            continue
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


def mask_api_key(value: str | None) -> str | None:
    if not value or not str(value).strip():
        return None
    raw = str(value).strip()
    if len(raw) <= 4:
        return "***"
    return f"***…{raw[-4:]}"


def api_key_configured(value: str | None) -> bool:
    return bool(value and str(value).strip())


def llm_override_snapshot_masked() -> dict[str, str | None]:
    snap = llm_override_snapshot()
    if not snap:
        return {}
    out: dict[str, str | None] = {}
    for key, val in snap.items():
        if key in ("api_key", "embedding_api_key") and val:
            out[key] = mask_api_key(val)
        else:
            out[key] = val
    return out


def embedding_uses_chat_config() -> bool:
    """True when embedding URL/key come from chat config (no dedicated env/override)."""
    if _override.get("embedding_base_url") or _override.get("embedding_api_key"):
        return False
    if settings.ASSISTANT_WIKI_EMBEDDING_BASE_URL.strip():
        return False
    if settings.ASSISTANT_WIKI_EMBEDDING_API_KEY.strip():
        return False
    return True
