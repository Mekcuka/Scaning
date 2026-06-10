"""Detailed LLM / embedding connectivity probes for admin UI."""

from __future__ import annotations

import time
from typing import Any

import httpx

PROBE_CACHE_TTL_SECONDS = 30
_probe_cache: dict[str, Any] | None = None
_probe_cache_at: float = 0.0

from app.assistant.knowledge.rag import get_rag_index, rag_enabled
from app.assistant.llm_override import get_effective_embedding_config, get_effective_llm_config
from app.core.config import settings


def _chat_headers(api_key: str, base_url: str) -> dict[str, str]:
    headers: dict[str, str] = {}
    if api_key.strip():
        headers["Authorization"] = f"Bearer {api_key.strip()}"
    if "openrouter.ai" in base_url:
        headers["HTTP-Referer"] = "https://mekcuka.github.io/Scaning/"
        headers["X-OpenRouter-Title"] = "Atlas Grid"
    return headers


def _hint_for_http(service: str, status_code: int | None, *, base_url: str) -> str:
    if status_code is None:
        return f"{service}: сервер недоступен — проверьте URL и что провайдер запущен."
    if status_code == 200:
        return f"{service}: OK."
    if status_code in (401, 403):
        return f"{service}: неверный API key (HTTP {status_code})."
    if status_code == 404:
        if service == "Embeddings":
            if "1234" in base_url or "11434" in base_url:
                return (
                    f"{service}: endpoint /embeddings не найден (HTTP 404). "
                    "Для LM Studio/Ollama загрузите embedding-модель (напр. nomic-embed-text)."
                )
        return f"{service}: endpoint не найден (HTTP 404)."
    if status_code == 429:
        return f"{service}: лимит запросов (HTTP 429). Подождите или смените модель."
    if status_code >= 500:
        return f"{service}: ошибка сервера (HTTP {status_code})."
    return f"{service}: HTTP {status_code}."


async def probe_chat_models() -> dict[str, Any]:
    cfg = get_effective_llm_config()
    if not cfg.base_url.strip():
        return {"ok": False, "http_status": None, "hint_ru": "Chat: не задан ASSISTANT_LLM_BASE_URL."}
    url = cfg.base_url.rstrip("/") + "/models"
    headers = _chat_headers(cfg.api_key, cfg.base_url)
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            res = await client.get(url, headers=headers)
        ok = res.status_code == 200
        return {
            "ok": ok,
            "http_status": res.status_code,
            "hint_ru": _hint_for_http("Chat (models)", res.status_code, base_url=cfg.base_url),
        }
    except httpx.HTTPError:
        return {
            "ok": False,
            "http_status": None,
            "hint_ru": _hint_for_http("Chat (models)", None, base_url=cfg.base_url),
        }


async def probe_chat_completion() -> dict[str, Any]:
    cfg = get_effective_llm_config()
    if not cfg.base_url.strip():
        return {"ok": False, "http_status": None, "hint_ru": "Chat: не задан base URL."}
    url = cfg.base_url.rstrip("/") + "/chat/completions"
    headers = {**_chat_headers(cfg.api_key, cfg.base_url), "Content-Type": "application/json"}
    payload: dict[str, Any] = {
        "messages": [{"role": "user", "content": "ping"}],
        "max_tokens": 1,
    }
    if cfg.model.strip():
        payload["model"] = cfg.model.strip()
    try:
        async with httpx.AsyncClient(timeout=min(cfg.timeout_seconds, 30)) as client:
            res = await client.post(url, json=payload, headers=headers)
        ok = res.status_code == 200
        hint = _hint_for_http("Chat (completion)", res.status_code, base_url=cfg.base_url)
        if ok and not cfg.model.strip():
            hint = "Chat: OK, но модель не задана — укажите ASSISTANT_LLM_MODEL."
            ok = False
        return {"ok": ok, "http_status": res.status_code, "hint_ru": hint}
    except httpx.HTTPError:
        return {
            "ok": False,
            "http_status": None,
            "hint_ru": _hint_for_http("Chat (completion)", None, base_url=cfg.base_url),
        }


async def probe_embeddings_endpoint() -> dict[str, Any]:
    if not settings.ASSISTANT_WIKI_RAG_ENABLED:
        return {"ok": False, "http_status": None, "hint_ru": "Wiki RAG выключен (ASSISTANT_WIKI_RAG_ENABLED=false)."}
    emb = get_effective_embedding_config()
    if not emb.base_url.strip():
        return {"ok": False, "http_status": None, "hint_ru": "Embeddings: не задан base URL."}
    url = emb.base_url.rstrip("/") + "/embeddings"
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if emb.api_key.strip():
        headers["Authorization"] = f"Bearer {emb.api_key.strip()}"
    payload = {"model": emb.model, "input": ["ping"]}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(url, headers=headers, json=payload)
        ok = res.status_code == 200
        return {
            "ok": ok,
            "http_status": res.status_code,
            "hint_ru": _hint_for_http("Embeddings", res.status_code, base_url=emb.base_url),
        }
    except httpx.HTTPError:
        return {
            "ok": False,
            "http_status": None,
            "hint_ru": _hint_for_http("Embeddings", None, base_url=emb.base_url),
        }


async def list_chat_models() -> list[str]:
    cfg = get_effective_llm_config()
    if not cfg.base_url.strip():
        return []
    url = cfg.base_url.rstrip("/") + "/models"
    headers = _chat_headers(cfg.api_key, cfg.base_url)
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            res = await client.get(url, headers=headers)
        if res.status_code != 200:
            return []
        data = res.json()
        items = data.get("data") if isinstance(data, dict) else data
        if not isinstance(items, list):
            return []
        ids: list[str] = []
        for item in items:
            if isinstance(item, dict):
                mid = item.get("id") or item.get("name")
                if isinstance(mid, str) and mid.strip():
                    ids.append(mid.strip())
            elif isinstance(item, str) and item.strip():
                ids.append(item.strip())
        return sorted(set(ids))
    except (httpx.HTTPError, ValueError, TypeError):
        return []


async def current_rag_mode_label() -> str:
    if not rag_enabled():
        return "disabled"
    index = await get_rag_index()
    if index is None:
        return "keyword"
    return index.mode


async def run_full_llm_probe() -> dict[str, Any]:
    global _probe_cache, _probe_cache_at
    models_probe = await probe_chat_models()
    completion_probe = await probe_chat_completion()
    embeddings_probe = await probe_embeddings_endpoint()
    rag_mode = await current_rag_mode_label()
    chat_ok = models_probe["ok"] and completion_probe["ok"]
    result = {
        "chat": {
            "ok": chat_ok,
            "models": models_probe,
            "completion": completion_probe,
        },
        "embeddings": embeddings_probe,
        "rag_mode": rag_mode,
        "provider_ready": chat_ok,
    }
    _probe_cache = result
    _probe_cache_at = time.monotonic()
    return result


def get_cached_probe_detail() -> dict[str, Any] | None:
    if _probe_cache is None:
        return None
    if time.monotonic() - _probe_cache_at > PROBE_CACHE_TTL_SECONDS:
        return None
    return _probe_cache


async def run_llm_test_message() -> dict[str, Any]:
    import time

    from app.assistant.chat.llm_client import chat_completion

    cfg = get_effective_llm_config()
    if not cfg.base_url.strip():
        return {"ok": False, "latency_ms": None, "model": cfg.model or None, "reply": None, "error": "llm_config"}
    if not cfg.model.strip():
        return {"ok": False, "latency_ms": None, "model": None, "reply": None, "error": "model_not_set"}
    started = time.perf_counter()
    try:
        response = await chat_completion([{"role": "user", "content": "Ответь одним словом: OK"}])
        latency_ms = int((time.perf_counter() - started) * 1000)
        reply = (response.content or "").strip()[:200] or None
        return {
            "ok": True,
            "latency_ms": latency_ms,
            "model": cfg.model.strip(),
            "reply": reply,
            "error": None,
        }
    except Exception as exc:
        latency_ms = int((time.perf_counter() - started) * 1000)
        code = getattr(exc, "code", None)
        return {
            "ok": False,
            "latency_ms": latency_ms,
            "model": cfg.model.strip(),
            "reply": None,
            "error": str(code or exc),
        }
