"""OpenAI-compatible embedding API for wiki RAG."""

from __future__ import annotations

import logging

import httpx
import numpy as np

from app.assistant.llm_override import get_effective_embedding_config, get_effective_llm_config
from app.core.config import settings

logger = logging.getLogger(__name__)


def embedding_model() -> str:
    return get_effective_embedding_config().model


async def probe_embedding_provider() -> bool:
    """Check whether the embedding endpoint accepts /embeddings (HTTP 200)."""
    if not settings.ASSISTANT_WIKI_RAG_ENABLED:
        return False
    emb = get_effective_embedding_config()
    if not emb.base_url.strip():
        return False
    url = emb.base_url.rstrip("/") + "/embeddings"
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if emb.api_key.strip():
        headers["Authorization"] = f"Bearer {emb.api_key.strip()}"
    payload = {"model": emb.model, "input": ["ping"]}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(url, headers=headers, json=payload)
            return res.status_code == 200
    except httpx.HTTPError:
        return False


async def embed_texts(texts: list[str]) -> list[np.ndarray]:
    if not texts:
        return []
    emb = get_effective_embedding_config()
    if not emb.base_url.strip():
        raise ValueError("Embedding base URL is not configured")
    url = emb.base_url.rstrip("/") + "/embeddings"
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if emb.api_key.strip():
        headers["Authorization"] = f"Bearer {emb.api_key.strip()}"
    payload = {"model": emb.model, "input": texts}
    timeout = get_effective_llm_config().timeout_seconds
    async with httpx.AsyncClient(timeout=timeout) as client:
        res = await client.post(url, headers=headers, json=payload)
        res.raise_for_status()
        data = res.json()
    items = sorted(data.get("data") or [], key=lambda row: row.get("index", 0))
    vectors: list[np.ndarray] = []
    for item in items:
        vec = item.get("embedding")
        if not isinstance(vec, list):
            raise ValueError("Invalid embedding response")
        vectors.append(np.asarray(vec, dtype=np.float64))
    if len(vectors) != len(texts):
        raise ValueError("Embedding count mismatch")
    return vectors
