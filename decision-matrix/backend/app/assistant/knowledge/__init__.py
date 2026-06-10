"""Assistant product wiki — markdown bundle for LLM tools and MCP resources."""

from app.assistant.knowledge.paths import resolve_wiki_root, wiki_enabled
from app.assistant.knowledge.store import (
    article_count,
    get_article,
    list_articles,
    list_resource_uris,
    manifest_json,
    read_resource,
    search,
)

__all__ = [
    "article_count",
    "get_article",
    "list_articles",
    "list_resource_uris",
    "manifest_json",
    "read_resource",
    "resolve_wiki_root",
    "search",
    "wiki_enabled",
]
