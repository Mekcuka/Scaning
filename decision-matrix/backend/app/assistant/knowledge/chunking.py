"""Split wiki articles into retrieval chunks."""

from __future__ import annotations

import re
from dataclasses import dataclass

from app.assistant.knowledge.manifest import WikiArticleMeta, read_article_body

_SECTION_RE = re.compile(r"(?m)^## ")


@dataclass(frozen=True, slots=True)
class WikiChunk:
    slug: str
    title: str
    heading: str
    text: str

    @property
    def chunk_id(self) -> str:
        safe_heading = self.heading.replace(" ", "-")[:40] if self.heading else "intro"
        return f"{self.slug}#{safe_heading}"

    def embed_text(self) -> str:
        parts = [self.title]
        if self.heading:
            parts.append(self.heading)
        parts.append(self.text)
        return "\n".join(parts)


def chunk_markdown(slug: str, title: str, body: str) -> list[WikiChunk]:
    parts = _SECTION_RE.split(body.strip())
    chunks: list[WikiChunk] = []
    intro = parts[0].strip() if parts else ""
    if intro:
        chunks.append(WikiChunk(slug=slug, title=title, heading="", text=intro))
    for part in parts[1:]:
        lines = part.split("\n", 1)
        heading = lines[0].strip()
        text = lines[1].strip() if len(lines) > 1 else ""
        if not text:
            continue
        chunks.append(WikiChunk(slug=slug, title=title, heading=heading, text=text))
    return chunks


def chunk_article(meta: WikiArticleMeta) -> list[WikiChunk]:
    body = read_article_body(meta)
    return chunk_markdown(meta.slug, meta.title, body)
