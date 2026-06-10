#!/usr/bin/env python3
"""Sync docs/wiki articles into backend knowledge bundle + manifest.json."""

from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
WIKI_ARTICLES = REPO_ROOT / "docs" / "wiki" / "articles"
BUNDLE_ROOT = (
    REPO_ROOT
    / "decision-matrix"
    / "backend"
    / "app"
    / "assistant"
    / "knowledge"
    / "bundle"
)
BUNDLE_ARTICLES = BUNDLE_ROOT / "articles"
MANIFEST_PATH = BUNDLE_ROOT / "manifest.json"

# Legacy MCP docs bundled for Docker (no monorepo root at runtime).
LEGACY_EXTRAS: tuple[tuple[str, Path], ...] = (
    (
        "extras/calculation-logic-flow.md",
        REPO_ROOT / "docs" / "calculations" / "calculation-logic-flow.md",
    ),
    (
        "extras/infrastructure_subtypes.json",
        REPO_ROOT / "decision-matrix" / "shared" / "infrastructure_subtypes.json",
    ),
)

_FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)
_LIST_RE = re.compile(r"^\s*\[([^\]]*)\]\s*$")
_SCALAR_RE = re.compile(r"^(\w+):\s*(.+)$")


def _parse_frontmatter(text: str) -> tuple[dict[str, object], str]:
    match = _FRONTMATTER_RE.match(text)
    if not match:
        raise ValueError("Missing YAML frontmatter")
    raw = match.group(1)
    body = text[match.end() :]
    meta: dict[str, object] = {}
    for line in raw.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        m = _LIST_RE.match(line)
        if m:
            continue
        sm = _SCALAR_RE.match(line)
        if not sm:
            continue
        key, value = sm.group(1), sm.group(2).strip()
        if value.startswith("[") and value.endswith("]"):
            inner = value[1:-1].strip()
            meta[key] = [p.strip() for p in inner.split(",") if p.strip()] if inner else []
        else:
            meta[key] = value.strip('"').strip("'")
    return meta, body


def _article_entry(path: Path, rel_file: str) -> dict[str, object]:
    text = path.read_text(encoding="utf-8")
    meta, body = _parse_frontmatter(text)
    slug = str(meta.get("slug") or path.stem)
    title = str(meta.get("title") or slug)
    summary = str(meta.get("summary") or "")
    tags = meta.get("tags") if isinstance(meta.get("tags"), list) else []
    tab_hints = meta.get("tab_hints") if isinstance(meta.get("tab_hints"), list) else []
    roles = meta.get("roles") if isinstance(meta.get("roles"), list) else []
    return {
        "slug": slug,
        "title": title,
        "summary": summary,
        "tags": tags,
        "tab_hints": tab_hints,
        "roles": roles,
        "file": rel_file,
        "char_count": len(body.strip()),
    }


def build_manifest(article_dir: Path) -> dict[str, object]:
    articles: list[dict[str, object]] = []
    for path in sorted(article_dir.glob("*.md")):
        rel = f"articles/{path.name}"
        articles.append(_article_entry(path, rel))
    slugs = [str(a["slug"]) for a in articles]
    if len(slugs) != len(set(slugs)):
        raise ValueError(f"Duplicate wiki slugs: {slugs}")
    return {
        "version": 1,
        "article_count": len(articles),
        "articles": articles,
    }


def sync(*, check_only: bool = False) -> int:
    if not WIKI_ARTICLES.is_dir():
        print(f"Wiki source not found: {WIKI_ARTICLES}", file=sys.stderr)
        return 1

    expected_manifest = build_manifest(WIKI_ARTICLES)
    manifest_text = json.dumps(expected_manifest, ensure_ascii=False, indent=2) + "\n"

    if check_only:
        if not MANIFEST_PATH.is_file():
            print("manifest.json missing — run sync without --check", file=sys.stderr)
            return 1
        current = MANIFEST_PATH.read_text(encoding="utf-8")
        if current != manifest_text:
            print("manifest.json is out of date — run sync-assistant-wiki.py", file=sys.stderr)
            return 1
        for article in expected_manifest["articles"]:
            rel = str(article["file"])
            dest = BUNDLE_ROOT / rel
            src = WIKI_ARTICLES / Path(rel).name
            if not dest.is_file() or dest.read_text(encoding="utf-8") != src.read_text(encoding="utf-8"):
                print(f"Bundle stale: {rel}", file=sys.stderr)
                return 1
        print("Wiki bundle is up to date.")
        return 0

    BUNDLE_ARTICLES.mkdir(parents=True, exist_ok=True)
    for path in WIKI_ARTICLES.glob("*.md"):
        shutil.copy2(path, BUNDLE_ARTICLES / path.name)

    extras_dir = BUNDLE_ROOT / "extras"
    extras_dir.mkdir(parents=True, exist_ok=True)
    for rel, src in LEGACY_EXTRAS:
        if not src.is_file():
            print(f"Warning: legacy extra missing: {src}", file=sys.stderr)
            continue
        dest = BUNDLE_ROOT / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dest)

    MANIFEST_PATH.write_text(manifest_text, encoding="utf-8")
    print(f"Synced {expected_manifest['article_count']} articles -> {BUNDLE_ROOT}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Sync docs/wiki to assistant knowledge bundle")
    parser.add_argument(
        "--check",
        action="store_true",
        help="Exit 1 if bundle is out of date (CI)",
    )
    args = parser.parse_args()
    return sync(check_only=args.check)


if __name__ == "__main__":
    raise SystemExit(main())
