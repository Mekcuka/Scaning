"""Simple full-text search over wiki articles."""

from __future__ import annotations

import re
from dataclasses import dataclass

from app.assistant.knowledge.manifest import WikiArticleMeta, read_article_body

_SNIPPET_MAX = 400
_WORD_RE = re.compile(r"\w+", re.UNICODE)


def normalize_text(text: str) -> str:
    lowered = text.lower().replace("ё", "е")
    return lowered


def tokenize(query: str) -> list[str]:
    return [normalize_text(w) for w in _WORD_RE.findall(query) if len(w) >= 2]


@dataclass(frozen=True, slots=True)
class WikiSearchHit:
    slug: str
    title: str
    score: float
    snippet: str


def _score_article(meta: WikiArticleMeta, body: str, tokens: list[str], query_norm: str) -> float:
    if not tokens and not query_norm:
        return 0.0

    slug_n = normalize_text(meta.slug)
    title_n = normalize_text(meta.title)
    summary_n = normalize_text(meta.summary)
    body_n = normalize_text(body)
    tags_n = " ".join(normalize_text(t) for t in meta.tags)

    score = 0.0
    if query_norm and (query_norm == slug_n or query_norm in slug_n):
        score += 100.0
    if query_norm and query_norm in title_n:
        score += 50.0

    for token in tokens:
        if token in slug_n:
            score += 30.0
        if token in title_n:
            score += 20.0
        for tag in meta.tags:
            tag_n = normalize_text(tag)
            if token in tag_n or (len(token) >= 4 and token[:4] in tag_n):
                score += 15.0
        if token in summary_n:
            score += 10.0
        if token in tags_n:
            score += 8.0
        if token in body_n:
            score += 5.0
            score += min(body_n.count(token), 5) * 1.0
        elif len(token) >= 5:
            stem = token[:5]
            if stem in body_n or stem in title_n or stem in summary_n:
                score += 4.0

    return score


def _make_snippet(body: str, tokens: list[str], summary: str) -> str:
    if summary.strip():
        base = summary.strip()
    else:
        base = body.strip().replace("\n", " ")
    if len(base) <= _SNIPPET_MAX:
        return base

    body_n = normalize_text(body)
    for token in tokens:
        idx = body_n.find(token)
        if idx >= 0:
            start = max(0, idx - 80)
            chunk = body[start : start + _SNIPPET_MAX].replace("\n", " ").strip()
            if start > 0:
                chunk = "…" + chunk
            if start + _SNIPPET_MAX < len(body):
                chunk = chunk + "…"
            return chunk

    return base[: _SNIPPET_MAX - 1] + "…"


def search_articles(
    articles: list[WikiArticleMeta],
    query: str,
    *,
    limit: int = 5,
) -> list[WikiSearchHit]:
    query_norm = normalize_text(query.strip())
    tokens = tokenize(query)
    if not query_norm:
        return []

    scored: list[WikiSearchHit] = []
    for meta in articles:
        body = read_article_body(meta)
        score = _score_article(meta, body, tokens, query_norm)
        if score <= 0:
            continue
        scored.append(
            WikiSearchHit(
                slug=meta.slug,
                title=meta.title,
                score=score,
                snippet=_make_snippet(body, tokens, meta.summary),
            )
        )

    scored.sort(key=lambda h: (-h.score, h.slug))
    return scored[:limit]
