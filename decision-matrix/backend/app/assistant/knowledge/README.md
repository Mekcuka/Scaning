# Assistant knowledge (wiki bundle)

Runtime markdown wiki for product help — used by chat tools and HTTP MCP resources.

## Source of truth

Editorial articles: [`docs/wiki/`](../../../../../docs/wiki/) in the monorepo.

## Sync

```powershell
python scripts/sync-assistant-wiki.py
```

Copies `docs/wiki/articles/` → `bundle/articles/`, legacy extras (`calculation-logic`, `infrastructure_subtypes`), and regenerates `bundle/manifest.json`.

## API

- `app.assistant.knowledge.store` — `list_articles`, `search`, `get_article`, `read_resource`
- Tools: `list_wiki_articles`, `search_wiki`, `get_wiki_article` (`tools/domain/knowledge.py`)
- MCP: `wiki://{slug}`, `wiki://index`; legacy `docs://*` reads from `bundle/extras/`

## Config

| Variable | Default |
|----------|---------|
| `ASSISTANT_WIKI_ENABLED` | `true` |
| `ASSISTANT_WIKI_ROOT` | `""` (use bundled `bundle/`) |
| `ASSISTANT_WIKI_MAX_ARTICLE_CHARS` | `12000` |
| `ASSISTANT_WIKI_RAG_ENABLED` | `true` — hybrid keyword + vector search |
| `ASSISTANT_WIKI_EMBEDDING_MODEL` | `""` — OpenAI-compatible `/embeddings` model |
| `ASSISTANT_WIKI_RAG_KEYWORD_WEIGHT` | `0.35` |
| `ASSISTANT_WIKI_RAG_VECTOR_WEIGHT` | `0.65` |
| `ASSISTANT_WIKI_RAG_MIN_SCORE` | `0.15` |

## RAG (phase 10.2)

- Articles split into `##` sections (`chunking.py`)
- Vector index: embeddings via LLM base URL when available; else TF-IDF fallback (`rag.py`)
- `search_wiki` returns `mode`: `keyword`, `hybrid-tfidf`, or `hybrid-embedding`
- Embedding cache: `bundle/.rag_cache/{manifest-hash}.json`
