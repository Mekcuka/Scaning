"""Wiki RAG — chunking, TF-IDF, hybrid search."""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, patch


from app.assistant.knowledge.chunking import chunk_markdown
from app.assistant.knowledge.manifest import filter_by_role, load_manifest
from app.assistant.knowledge.rag import hybrid_search_articles
from app.assistant.knowledge.tfidf import build_tfidf_index
from app.models.enums import UserRole


def test_chunk_markdown_splits_sections():
    body = "# Title\n\nIntro text.\n\n## Section A\n\nBody A.\n\n## Section B\n\nBody B."
    chunks = chunk_markdown("map-2d", "Карта", body)
    assert len(chunks) == 3
    assert chunks[0].heading == ""
    assert chunks[1].heading == "Section A"
    assert "Body B" in chunks[2].text


def test_tfidf_finds_relevant_chunk():
    texts = [
        "карта слои openlayers инфраструктура",
        "матрица сравнение вариантов poi",
        "импорт geojson csv shapefile",
    ]
    index = build_tfidf_index(texts, ["a", "b", "c"])
    scores = index.query_scores("как включить слои на карте")
    assert scores.argmax() == 0


def test_hybrid_search_tfidf_mode(monkeypatch):
    monkeypatch.setattr("app.assistant.knowledge.rag.rag_enabled", lambda: True)

    async def _fake_build(articles, fingerprint):
        from app.assistant.knowledge.chunking import chunk_article
        from app.assistant.knowledge.rag import RagIndex
        from app.assistant.knowledge.tfidf import build_tfidf_index

        chunks = []
        for meta in articles:
            chunks.extend(chunk_article(meta))
        texts = [c.embed_text() for c in chunks]
        tfidf = build_tfidf_index(texts, [c.chunk_id for c in chunks])
        return RagIndex(chunks=chunks, tfidf=tfidf, embeddings=None, mode="tfidf")

    async def _run():
        with patch("app.assistant.knowledge.rag.probe_embedding_provider", new_callable=AsyncMock, return_value=False):
            with patch("app.assistant.knowledge.rag._build_index", side_effect=_fake_build):
                articles = filter_by_role(load_manifest(), UserRole.analyst)
                return await hybrid_search_articles(articles, "слои карта", limit=3)

    hits, mode = asyncio.run(_run())
    assert mode == "hybrid-tfidf"
    assert hits
    assert any(h.slug == "map-2d" for h in hits)


def test_store_search_returns_mode():
    from app.assistant.knowledge.store import search

    async def _run():
        with patch("app.assistant.knowledge.store.rag_enabled", return_value=False):
            return await search("импорт", UserRole.analyst, limit=3)

    result = asyncio.run(_run())
    assert result["mode"] == "keyword"
    assert result["hits"]
