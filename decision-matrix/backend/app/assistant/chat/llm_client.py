"""OpenAI-compatible LLM HTTP client (LM Studio, OpenRouter, OpenAI)."""

from __future__ import annotations

import json
import re
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any

_TOOL_CALL_BLOCK = re.compile(
    r"<tool_call>\s*(\{.*?\})\s*</tool_call>",
    re.DOTALL | re.IGNORECASE,
)

# OpenRouter `openrouter/free` may route to nvidia/nemotron-3.5-content-safety — not a chat model.
_SAFETY_LABEL_LINE = re.compile(
    r"^(User Safety|Response Safety|Safety Categories):",
    re.IGNORECASE,
)

import httpx

from app.assistant.chat.errors import ChatError
from app.assistant.llm_override import get_effective_llm_config
from app.core.config import settings


@dataclass(slots=True)
class LlmToolCall:
    id: str
    name: str
    arguments: dict[str, Any]


@dataclass(slots=True)
class LlmResponse:
    content: str | None = None
    tool_calls: list[LlmToolCall] = field(default_factory=list)
    finish_reason: str | None = None


def is_content_safety_verdict(text: str | None) -> bool:
    """True when the model returned only moderation labels, not a chat answer."""
    if not text or not text.strip():
        return False
    lines = [ln.strip() for ln in text.strip().splitlines() if ln.strip()]
    if not lines:
        return False
    return all(_SAFETY_LABEL_LINE.match(ln) for ln in lines)


def _llm_headers() -> dict[str, str]:
    cfg = get_effective_llm_config()
    headers = {"Content-Type": "application/json"}
    if cfg.api_key.strip():
        headers["Authorization"] = f"Bearer {cfg.api_key.strip()}"
    if "openrouter.ai" in cfg.base_url:
        headers["HTTP-Referer"] = "https://mekcuka.github.io/Scaning/"
        headers["X-OpenRouter-Title"] = "Atlas Grid"
    return headers


def _llm_url() -> str:
    cfg = get_effective_llm_config()
    if not cfg.base_url.strip():
        raise ChatError("LLM base URL is not configured", code="llm_config")
    return cfg.base_url.rstrip("/") + "/chat/completions"


def _build_payload(
    messages: list[dict[str, Any]],
    tools: list[dict[str, Any]] | None,
    *,
    stream: bool = False,
) -> dict[str, Any]:
    payload: dict[str, Any] = {"messages": messages}
    model = get_effective_llm_config().model.strip()
    if model:
        payload["model"] = model
    if tools:
        payload["tools"] = tools
        payload["tool_choice"] = "auto"
    if stream:
        payload["stream"] = True
    payload["max_tokens"] = settings.ASSISTANT_LLM_MAX_TOKENS
    return payload


def _message_text(message: dict[str, Any]) -> str | None:
    content = message.get("content")
    if isinstance(content, list):
        content = "".join(
            part.get("text", "") for part in content if isinstance(part, dict)
        )
    if isinstance(content, str) and content.strip():
        if is_content_safety_verdict(content):
            raise ChatError(
                "LLM вернул метки модерации вместо ответа — смените ASSISTANT_LLM_MODEL "
                "(не используйте openrouter/free; попробуйте nvidia/nemotron-nano-9b-v2:free)",
                code="llm_safety_router",
            )
        return content
    for key in ("reasoning_content", "reasoning"):
        fallback = message.get(key)
        if isinstance(fallback, str) and fallback.strip():
            if is_content_safety_verdict(fallback):
                raise ChatError(
                    "LLM вернул метки модерации вместо ответа — смените ASSISTANT_LLM_MODEL",
                    code="llm_safety_router",
                )
            return fallback
    return None


def parse_text_tool_calls(content: str | None) -> list[LlmToolCall]:
    """Fallback for local models (Qwen/LM Studio) that emit tool calls as text."""
    if not content:
        return []
    out: list[LlmToolCall] = []
    for index, match in enumerate(_TOOL_CALL_BLOCK.finditer(content)):
        try:
            data = json.loads(match.group(1))
        except json.JSONDecodeError:
            continue
        name = data.get("name")
        if not isinstance(name, str) or not name.strip():
            continue
        arguments = data.get("arguments") or {}
        if not isinstance(arguments, dict):
            arguments = {}
        out.append(
            LlmToolCall(
                id=f"text_call_{index}_{name}",
                name=name.strip(),
                arguments=arguments,
            )
        )
    return out


def strip_text_tool_calls(content: str | None) -> str | None:
    """Remove Qwen-style <tool_call> blocks from assistant text shown to the user."""
    if not content:
        return None
    cleaned = _TOOL_CALL_BLOCK.sub("", content).strip()
    return cleaned or None


def _strip_text_tool_calls(content: str | None) -> str | None:
    return strip_text_tool_calls(content)


def enrich_llm_response(response: LlmResponse) -> LlmResponse:
    if response.tool_calls:
        return response
    text_calls = parse_text_tool_calls(response.content)
    if not text_calls:
        return response
    return LlmResponse(
        content=_strip_text_tool_calls(response.content),
        tool_calls=text_calls,
        finish_reason=response.finish_reason,
    )


def _parse_tool_calls(raw_calls: list[dict[str, Any]]) -> list[LlmToolCall]:
    out: list[LlmToolCall] = []
    for item in raw_calls:
        fn = item.get("function") or {}
        name = fn.get("name")
        if not name:
            continue
        raw_args = fn.get("arguments") or "{}"
        if isinstance(raw_args, dict):
            args = raw_args
        else:
            try:
                args = json.loads(raw_args)
            except json.JSONDecodeError:
                args = {}
        out.append(LlmToolCall(id=item.get("id") or name, name=name, arguments=args))
    return out


async def chat_completion(
    messages: list[dict[str, Any]],
    tools: list[dict[str, Any]] | None = None,
) -> LlmResponse:
    url = _llm_url()
    payload = _build_payload(messages, tools)
    headers = _llm_headers()

    try:
        async with httpx.AsyncClient(timeout=settings.ASSISTANT_LLM_TIMEOUT_SECONDS) as client:
            res = await client.post(url, json=payload, headers=headers)
    except httpx.TimeoutException as e:
        raise ChatError("LLM request timed out", code="llm_timeout") from e
    except httpx.RequestError as e:
        raise ChatError(f"LLM connection failed: {e}", code="llm_connection") from e

    if res.status_code >= 400:
        detail = res.text[:500]
        raise ChatError(f"LLM error {res.status_code}: {detail}", code="llm_http")

    try:
        data = res.json()
    except ValueError as e:
        raise ChatError("LLM returned invalid JSON", code="llm_parse") from e

    choices = data.get("choices") or []
    if not choices:
        raise ChatError("LLM returned no choices", code="llm_empty")

    message = choices[0].get("message") or {}
    tool_calls = _parse_tool_calls(message.get("tool_calls") or [])
    content = _message_text(message)
    return enrich_llm_response(
        LlmResponse(
            content=content,
            tool_calls=tool_calls,
            finish_reason=choices[0].get("finish_reason"),
        )
    )


async def chat_completion_stream(
    messages: list[dict[str, Any]],
    tools: list[dict[str, Any]] | None = None,
) -> AsyncIterator[str]:
    """Yield text deltas from an OpenAI-compatible streaming completion."""
    url = _llm_url()
    payload = _build_payload(messages, tools, stream=True)
    headers = _llm_headers()

    try:
        async with httpx.AsyncClient(timeout=settings.ASSISTANT_LLM_TIMEOUT_SECONDS) as client:
            async with client.stream("POST", url, json=payload, headers=headers) as res:
                if res.status_code >= 400:
                    body = (await res.aread()).decode("utf-8", errors="replace")[:500]
                    raise ChatError(f"LLM error {res.status_code}: {body}", code="llm_http")

                async for line in res.aiter_lines():
                    if not line or not line.startswith("data:"):
                        continue
                    raw = line[5:].strip()
                    if raw == "[DONE]":
                        break
                    try:
                        chunk = json.loads(raw)
                    except json.JSONDecodeError:
                        continue
                    choices = chunk.get("choices") or []
                    if not choices:
                        continue
                    delta = choices[0].get("delta") or {}
                    if delta.get("tool_calls"):
                        raise ChatError(
                            "LLM returned tool_calls in stream; use non-stream completion",
                            code="llm_stream_tools",
                        )
                    content = delta.get("content")
                    if isinstance(content, list):
                        content = "".join(
                            part.get("text", "") for part in content if isinstance(part, dict)
                        )
                    if not content:
                        for key in ("reasoning_content", "reasoning"):
                            reasoning = delta.get(key)
                            if isinstance(reasoning, str):
                                content = reasoning
                                break
                    if content:
                        yield content
    except httpx.TimeoutException as e:
        raise ChatError("LLM request timed out", code="llm_timeout") from e
    except httpx.RequestError as e:
        raise ChatError(f"LLM connection failed: {e}", code="llm_connection") from e


async def probe_provider() -> bool:
    """Lightweight readiness check for status endpoint."""
    cfg = get_effective_llm_config()
    if not cfg.base_url.strip():
        return False
    url = cfg.base_url.rstrip("/") + "/models"
    headers: dict[str, str] = {}
    if cfg.api_key.strip():
        headers["Authorization"] = f"Bearer {cfg.api_key.strip()}"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            res = await client.get(url, headers=headers)
            return res.status_code < 500
    except httpx.HTTPError:
        return False
