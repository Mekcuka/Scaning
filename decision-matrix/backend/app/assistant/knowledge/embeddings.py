"""OpenAI-compatible embedding API for wiki RAG."""

from __future__ import annotations

import logging

import httpx
import numpy as np

from app.assistant.llm_override import get_effective_llm_config
from app.core.config import settings

logger = logging.getLogger(__name__)


def embedding_model() -> str:
    configured = settings.ASSISTANT_WIKI_EMBEDDING_MODEL.strip()
    if configured:
        return configured
    return "text-embedding-3-small"


async def probe_embedding_provider() -> bool:
    """Check whether the LLM base URL accepts /embeddings."""
    if not settings.ASSISTANT_WIKI_RAG_ENABLED:
        return False
    cfg = get_effective_llm_config()
    if not cfg.base_url.strip():
        return False
    url = cfg.base_url.rstrip("/") + "/embeddings"
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if cfg.api_key.strip():
        headers["Authorization"] = f"Bearer {cfg.api_key.strip()}"
    payload = {"model": embedding_model(), "input": ["ping"]}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(url, headers=headers, json=payload)
            return res.status_code < 400
    except httpx.HTTPError:
        return False


async def embed_texts(texts: list[str]) -> list[np.ndarray]:
    if not texts:
        return []
    cfg = get_effective_llm_config()
    url = cfg.base_url.rstrip("/") + "/embeddings"
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if cfg.api_key.strip():
        headers["Authorization"] = f"Bearer {cfg.api_key.strip()}"
    payload = {"model": embedding_model(), "input": texts}
    async with httpx.AsyncClient(timeout=settings.ASSISTANT_LLM_TIMEOUT_SECONDS) as client:
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
