"""Wiki RAG index and hybrid search (keyword + vector)."""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from app.assistant.knowledge.chunking import WikiChunk, chunk_article
from app.assistant.knowledge.embeddings import embed_texts, probe_embedding_provider
from app.assistant.knowledge.manifest import WikiArticleMeta, load_manifest
from app.assistant.knowledge.paths import resolve_wiki_root
from app.assistant.knowledge.search import WikiSearchHit, search_articles
from app.assistant.knowledge.tfidf import TfidfIndex, build_tfidf_index
from app.core.config import settings

logger = logging.getLogger(__name__)

_lock = asyncio.Lock()
_index: RagIndex | None = None
_index_fingerprint: str | None = None


@dataclass
class RagIndex:
    chunks: list[WikiChunk]
    tfidf: TfidfIndex
    embeddings: np.ndarray | None  # (n_chunks, dim) or None
    mode: str  # "embedding" | "tfidf"

    def vector_scores(self, query: str, query_vector: np.ndarray | None = None) -> np.ndarray:
        if query_vector is not None and self.embeddings is not None:
            norms = np.linalg.norm(self.embeddings, axis=1) * np.linalg.norm(query_vector)
            norms = np.where(norms == 0, 1.0, norms)
            return (self.embeddings @ query_vector) / norms
        return self.tfidf.query_scores(query)


def manifest_fingerprint() -> str:
    root = resolve_wiki_root()
    path = root / "manifest.json"
    if not path.is_file():
        return ""
    return hashlib.sha256(path.read_bytes()).hexdigest()[:16]


def rag_enabled() -> bool:
    return settings.ASSISTANT_WIKI_RAG_ENABLED


def _cache_path(fingerprint: str) -> Path:
    return resolve_wiki_root() / ".rag_cache" / f"{fingerprint}.json"


def _load_embedding_cache(fingerprint: str, chunk_ids: list[str]) -> dict[str, list[float]] | None:
    path = _cache_path(fingerprint)
    if not path.is_file():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if data.get("fingerprint") != fingerprint:
            return None
        vectors = data.get("vectors") or {}
        if set(vectors.keys()) != set(chunk_ids):
            return None
        return vectors
    except (OSError, json.JSONDecodeError, TypeError):
        return None


def _save_embedding_cache(fingerprint: str, vectors: dict[str, list[float]]) -> None:
    path = _cache_path(fingerprint)
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {"fingerprint": fingerprint, "vectors": vectors}
    path.write_text(json.dumps(payload), encoding="utf-8")


async def _build_index(articles: list[WikiArticleMeta], fingerprint: str) -> RagIndex:
    chunks: list[WikiChunk] = []
    for meta in articles:
        chunks.extend(chunk_article(meta))
    texts = [c.embed_text() for c in chunks]
    chunk_ids = [c.chunk_id for c in chunks]
    tfidf = build_tfidf_index(texts, chunk_ids)

    embeddings: np.ndarray | None = None
    mode = "tfidf"
    if rag_enabled() and await probe_embedding_provider():
        cached = _load_embedding_cache(fingerprint, chunk_ids)
        if cached:
            embeddings = np.asarray([cached[cid] for cid in chunk_ids], dtype=np.float64)
            mode = "embedding"
        else:
            try:
                vectors = await embed_texts(texts)
                embeddings = np.vstack(vectors)
                _save_embedding_cache(
                    fingerprint,
                    {cid: vec.tolist() for cid, vec in zip(chunk_ids, vectors, strict=True)},
                )
                mode = "embedding"
            except Exception:
                logger.warning("Wiki embedding index build failed; using TF-IDF fallback", exc_info=True)

    return RagIndex(chunks=chunks, tfidf=tfidf, embeddings=embeddings, mode=mode)


async def get_rag_index() -> RagIndex | None:
    global _index, _index_fingerprint
    if not rag_enabled():
        return None
    fingerprint = manifest_fingerprint()
    if not fingerprint:
        return None
    if _index is not None and _index_fingerprint == fingerprint:
        return _index
    async with _lock:
        if _index is not None and _index_fingerprint == fingerprint:
            return _index
        _index = await _build_index(list(load_manifest()), fingerprint)
        _index_fingerprint = fingerprint
        return _index


def clear_rag_cache() -> None:
    global _index, _index_fingerprint
    _index = None
    _index_fingerprint = None


def _aggregate_chunk_scores(
    chunks: list[WikiChunk],
    scores: np.ndarray,
    metas_by_slug: dict[str, WikiArticleMeta],
) -> dict[str, tuple[float, str]]:
    best: dict[str, tuple[float, str]] = {}
    for chunk, score in zip(chunks, scores, strict=True):
        if score <= 0:
            continue
        snippet = chunk.text.replace("\n", " ").strip()
        if len(snippet) > 400:
            snippet = snippet[:399] + "…"
        if chunk.heading:
            snippet = f"{chunk.heading}: {snippet}"
        prev = best.get(chunk.slug)
        if prev is None or score > prev[0]:
            best[chunk.slug] = (float(score), snippet)
    for slug in list(best.keys()):
        if slug not in metas_by_slug:
            del best[slug]
    return best


async def hybrid_search_articles(
    articles: list[WikiArticleMeta],
    query: str,
    *,
    limit: int = 5,
) -> tuple[list[WikiSearchHit], str]:
    """Return hits and search mode: keyword | hybrid-tfidf | hybrid-embedding."""
    keyword_hits = search_articles(articles, query, limit=max(limit * 2, 10))
    if not rag_enabled():
        return keyword_hits[:limit], "keyword"

    index = await get_rag_index()
    if index is None:
        return keyword_hits[:limit], "keyword"

    query_vector: np.ndarray | None = None
    if index.embeddings is not None:
        try:
            query_vector = (await embed_texts([query]))[0]
        except Exception:
            logger.warning("Wiki query embedding failed; TF-IDF for this query", exc_info=True)

    vec_scores = index.vector_scores(query, query_vector)
    metas_by_slug = {a.slug: a for a in articles}
    vector_by_slug = _aggregate_chunk_scores(index.chunks, vec_scores, metas_by_slug)

    kw_weight = settings.ASSISTANT_WIKI_RAG_KEYWORD_WEIGHT
    vec_weight = settings.ASSISTANT_WIKI_RAG_VECTOR_WEIGHT
    max_kw = max((h.score for h in keyword_hits), default=1.0) or 1.0
    max_vec = max((s for s, _ in vector_by_slug.values()), default=1.0) or 1.0

    combined: dict[str, WikiSearchHit] = {}
    for hit in keyword_hits:
        combined[hit.slug] = WikiSearchHit(
            slug=hit.slug,
            title=hit.title,
            score=kw_weight * (hit.score / max_kw),
            snippet=hit.snippet,
        )
    for slug, (vec_score, snippet) in vector_by_slug.items():
        norm_vec = vec_weight * (vec_score / max_vec)
        if slug in combined:
            prev = combined[slug]
            combined[slug] = WikiSearchHit(
                slug=slug,
                title=prev.title,
                score=prev.score + norm_vec,
                snippet=prev.snippet if len(prev.snippet) >= len(snippet) else snippet,
            )
        else:
            meta = metas_by_slug[slug]
            combined[slug] = WikiSearchHit(
                slug=slug,
                title=meta.title,
                score=norm_vec,
                snippet=snippet or meta.summary,
            )

    min_score = settings.ASSISTANT_WIKI_RAG_MIN_SCORE
    keyword_slugs = {h.slug for h in keyword_hits if h.score > 0}
    ranked = [
        h
        for h in combined.values()
        if h.slug in keyword_slugs or h.score >= min_score
    ]
    ranked.sort(key=lambda h: (-h.score, h.slug))
    mode = f"hybrid-{index.mode}"
    return ranked[:limit], mode


async def rag_status() -> dict[str, object]:
    if not rag_enabled():
        return {"wiki_rag_enabled": False, "wiki_rag_mode": "keyword"}
    ready = await probe_embedding_provider()
    index = await get_rag_index()
    mode = index.mode if index else "tfidf"
    return {
        "wiki_rag_enabled": True,
        "wiki_rag_embedding_ready": ready,
        "wiki_rag_mode": f"hybrid-{mode}" if index else "keyword",
        "wiki_rag_chunks": len(index.chunks) if index else 0,
    }
