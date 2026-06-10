"""Load and cache wiki manifest.json."""

from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.assistant.knowledge.paths import resolve_wiki_root
from app.models.enums import UserRole


@dataclass(frozen=True, slots=True)
class WikiArticleMeta:
    slug: str
    title: str
    summary: str
    tags: tuple[str, ...]
    tab_hints: tuple[str, ...]
    roles: tuple[str, ...]
    file: str
    char_count: int


def _parse_meta(raw: dict[str, Any]) -> WikiArticleMeta:
    return WikiArticleMeta(
        slug=str(raw["slug"]),
        title=str(raw.get("title") or raw["slug"]),
        summary=str(raw.get("summary") or ""),
        tags=tuple(str(t) for t in (raw.get("tags") or [])),
        tab_hints=tuple(str(t) for t in (raw.get("tab_hints") or [])),
        roles=tuple(str(r) for r in (raw.get("roles") or [])),
        file=str(raw["file"]),
        char_count=int(raw.get("char_count") or 0),
    )


def clear_manifest_cache() -> None:
    load_manifest.cache_clear()
    from app.assistant.knowledge.rag import clear_rag_cache

    clear_rag_cache()


@lru_cache(maxsize=1)
def load_manifest() -> tuple[WikiArticleMeta, ...]:
    root = resolve_wiki_root()
    path = root / "manifest.json"
    if not path.is_file():
        return ()
    data = json.loads(path.read_text(encoding="utf-8"))
    articles = data.get("articles") or []
    return tuple(_parse_meta(item) for item in articles)


def article_visible_for(meta: WikiArticleMeta, role: UserRole) -> bool:
    if not meta.roles:
        return True
    return role.value in meta.roles


def filter_by_role(articles: tuple[WikiArticleMeta, ...], role: UserRole) -> list[WikiArticleMeta]:
    return [a for a in articles if article_visible_for(a, role)]


def read_article_body(meta: WikiArticleMeta) -> str:
    root = resolve_wiki_root()
    path = (root / meta.file).resolve()
    if not path.is_file():
        raise FileNotFoundError(f"Wiki article file not found: {meta.file}")
    text = path.read_text(encoding="utf-8")
    return _strip_frontmatter(text)


def _strip_frontmatter(text: str) -> str:
    if text.startswith("---\n"):
        end = text.find("\n---\n", 4)
        if end != -1:
            return text[end + 5 :].lstrip("\n")
    return text


def read_legacy_extra(relative: str) -> str:
    root = resolve_wiki_root()
    path = (root / relative).resolve()
    if not path.is_file():
        raise FileNotFoundError(f"Wiki extra not found: {relative}")
    return path.read_text(encoding="utf-8")
