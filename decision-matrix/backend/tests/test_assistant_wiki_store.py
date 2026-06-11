"""Assistant wiki store — manifest, search, RBAC."""

from __future__ import annotations

import pytest

from app.assistant.knowledge.search import search_articles
from app.assistant.knowledge.store import article_count, get_article, list_articles, search
from app.models.enums import UserRole
from app.assistant.knowledge.manifest import filter_by_role, load_manifest


def test_manifest_loads_articles():
    articles = load_manifest()
    assert len(articles) >= 8
    slugs = {a.slug for a in articles}
    assert "navigation" in slugs
    assert "map-2d" in slugs


def test_article_count():
    assert article_count() >= 8


def test_search_map_keyword():
    articles = filter_by_role(load_manifest(), UserRole.analyst)
    hits = search_articles(articles, "карта слои", limit=3)
    assert hits
    assert any(h.slug == "map-2d" for h in hits)


def test_search_wiki_api():
    import asyncio

    # Query must rank import-spark in both keyword and hybrid-tfidf modes.
    result = asyncio.run(search("импорт искра", UserRole.analyst, limit=5))
    assert result["query"] == "импорт искра"
    assert result["mode"]
    assert result["hits"]
    assert result["hits"][0]["slug"] == "import-spark"


def test_get_article_by_slug():
    article = get_article("matrix", UserRole.viewer)
    assert article["slug"] == "matrix"
    assert "Матрица" in article["title"]
    assert len(article["body_markdown"]) > 50


def test_get_unknown_slug_raises():
    with pytest.raises(FileNotFoundError):
        get_article("no-such-article", UserRole.viewer)


def test_list_articles_tag_filter():
    listed = list_articles(UserRole.analyst, tag="map")
    assert listed
    assert all("map" in a["tags"] for a in listed)


def test_truncate_long_article(monkeypatch):
    monkeypatch.setattr("app.assistant.knowledge.store.settings.ASSISTANT_WIKI_MAX_ARTICLE_CHARS", 50)
    article = get_article("navigation", UserRole.viewer)
    assert article["truncated"] is True
    assert len(article["body_markdown"]) <= 60
