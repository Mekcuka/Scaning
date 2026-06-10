"""Public wiki store API for tools and MCP resources."""

from __future__ import annotations

import json
from typing import Any

from app.assistant.knowledge.manifest import (
    WikiArticleMeta,
    article_visible_for,
    filter_by_role,
    load_manifest,
    read_article_body,
    read_legacy_extra,
)
from app.assistant.knowledge.paths import wiki_enabled
from app.assistant.knowledge.rag import hybrid_search_articles, rag_enabled
from app.assistant.knowledge.search import search_articles
from app.core.config import settings
from app.models.enums import UserRole


class WikiDisabledError(RuntimeError):
    pass


def _require_enabled() -> None:
    if not wiki_enabled():
        raise WikiDisabledError("Assistant wiki is disabled or bundle missing")


def article_count() -> int:
    if not wiki_enabled():
        return 0
    return len(load_manifest())


def list_articles(
    role: UserRole,
    *,
    tag: str | None = None,
    tab_hint: str | None = None,
) -> list[dict[str, Any]]:
    _require_enabled()
    articles = filter_by_role(load_manifest(), role)
    if tag:
        tag_n = tag.lower()
        articles = [a for a in articles if any(t.lower() == tag_n for t in a.tags)]
    if tab_hint:
        hint_n = tab_hint.lower()
        articles = [a for a in articles if any(h.lower() == hint_n for h in a.tab_hints)]
    return [
        {
            "slug": a.slug,
            "title": a.title,
            "summary": a.summary,
            "tags": list(a.tags),
        }
        for a in articles
    ]


def get_article(slug: str, role: UserRole) -> dict[str, Any]:
    _require_enabled()
    meta = _find_slug(slug)
    if meta is None:
        raise FileNotFoundError(f"Unknown wiki article: {slug}")
    if not article_visible_for(meta, role):
        raise PermissionError(f"Wiki article not available for role: {role.value}")

    body = read_article_body(meta)
    max_chars = settings.ASSISTANT_WIKI_MAX_ARTICLE_CHARS
    truncated = False
    if len(body) > max_chars:
        body = body[:max_chars].rstrip() + "\n\n…"
        truncated = True

    return {
        "slug": meta.slug,
        "title": meta.title,
        "summary": meta.summary,
        "body_markdown": body,
        "truncated": truncated,
    }


async def search(
    query: str,
    role: UserRole,
    *,
    limit: int = 5,
) -> dict[str, Any]:
    _require_enabled()
    articles = filter_by_role(load_manifest(), role)
    if rag_enabled():
        hits, mode = await hybrid_search_articles(articles, query, limit=limit)
    else:
        hits = search_articles(articles, query, limit=limit)
        mode = "keyword"
    return {
        "query": query,
        "mode": mode,
        "hits": [
            {
                "slug": h.slug,
                "title": h.title,
                "score": round(h.score, 2),
                "snippet": h.snippet,
            }
            for h in hits
        ],
    }


def manifest_json() -> str:
    _require_enabled()
    path = load_manifest()
    payload = {
        "version": 1,
        "article_count": len(path),
        "articles": [
            {
                "slug": a.slug,
                "title": a.title,
                "summary": a.summary,
                "tags": list(a.tags),
                "tab_hints": list(a.tab_hints),
                "roles": list(a.roles),
                "file": a.file,
                "char_count": a.char_count,
            }
            for a in path
        ],
    }
    return json.dumps(payload, ensure_ascii=False, indent=2)


def read_resource(uri: str, role: UserRole | None = None) -> tuple[str, str]:
    """MCP resource reader: wiki://slug, wiki://index, docs:// legacy aliases."""
    _require_enabled()

    if uri == "wiki://index":
        return manifest_json(), "application/json"

    if uri.startswith("wiki://"):
        slug = uri[len("wiki://") :]
        if not slug:
            raise FileNotFoundError(f"Invalid wiki URI: {uri}")
        if role is None:
            role = UserRole.viewer
        article = get_article(slug, role)
        return article["body_markdown"], "text/markdown"

    if uri == "docs://calculation-logic":
        return read_legacy_extra("extras/calculation-logic-flow.md"), "text/markdown"

    if uri == "docs://infrastructure-subtypes":
        return read_legacy_extra("extras/infrastructure_subtypes.json"), "application/json"

    raise FileNotFoundError(f"Unknown resource URI: {uri}")


def list_resource_uris() -> list[tuple[str, str, str, str]]:
    """Return (uri, name, description, mime_type) for wiki articles + index."""
    if not wiki_enabled():
        return []
    out: list[tuple[str, str, str, str]] = [
        (
            "wiki://index",
            "wiki-index",
            "Wiki article manifest (JSON)",
            "application/json",
        ),
    ]
    for meta in load_manifest():
        out.append(
            (
                f"wiki://{meta.slug}",
                f"wiki-{meta.slug}",
                meta.summary or meta.title,
                "text/markdown",
            )
        )
    return out


def _find_slug(slug: str) -> WikiArticleMeta | None:
    for meta in load_manifest():
        if meta.slug == slug:
            return meta
    return None
