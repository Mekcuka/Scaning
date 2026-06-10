"""Product wiki assistant tools (how-to, not live project data)."""

from __future__ import annotations

from pydantic import BaseModel, Field

from app.assistant.context import ToolContext
from app.assistant.knowledge.store import get_article, list_articles, search
from app.assistant.registry import register_tool
from app.assistant.tools.base import ToolDefinition
from app.assistant.tools.categories import CAT_HELP, cats
from app.services.project_access import user_role


class ListWikiArticlesInput(BaseModel):
    tag: str | None = Field(default=None, description="Filter by tag (e.g. map, import)")
    tab_hint: str | None = Field(
        default=None,
        description="Filter by UI tab hint (e.g. map, matrix, flows/logistics)",
    )


class SearchWikiInput(BaseModel):
    query: str = Field(min_length=1, description="Search query in Russian or English")
    limit: int = Field(default=5, ge=1, le=10)


class GetWikiArticleInput(BaseModel):
    slug: str = Field(min_length=1, description="Article slug (e.g. map-2d, navigation)")


async def _list_wiki_articles(ctx: ToolContext, args: ListWikiArticlesInput) -> list[dict]:
    role = user_role(ctx.user)
    return list_articles(role, tag=args.tag, tab_hint=args.tab_hint)


async def _search_wiki(ctx: ToolContext, args: SearchWikiInput) -> dict:
    role = user_role(ctx.user)
    return await search(args.query, role, limit=args.limit)


async def _get_wiki_article(ctx: ToolContext, args: GetWikiArticleInput) -> dict:
    role = user_role(ctx.user)
    try:
        return get_article(args.slug, role)
    except FileNotFoundError as e:
        raise ValueError(str(e)) from e
    except PermissionError as e:
        raise ValueError(str(e)) from e


def register() -> None:
    from app.assistant.knowledge.paths import wiki_enabled

    if not wiki_enabled():
        return

    register_tool(
        ToolDefinition(
            name="list_wiki_articles",
            description=(
                "List Atlas Grid product help articles (UI how-to, roles, workflows). "
                "Not live project data — use list_projects / list_pois for facts."
            ),
            input_model=ListWikiArticlesInput,
            handler=_list_wiki_articles,
            categories=cats(CAT_HELP),
        )
    )
    register_tool(
        ToolDefinition(
            name="search_wiki",
            description=(
                "Search product help wiki (keyword + semantic RAG over article chunks). "
                "How-to questions about UI, import, map, matrix. "
                "Returns snippets — use get_wiki_article for full text."
            ),
            input_model=SearchWikiInput,
            handler=_search_wiki,
            categories=cats(CAT_HELP),
        )
    )
    register_tool(
        ToolDefinition(
            name="get_wiki_article",
            description="Get full markdown text of a product help article by slug.",
            input_model=GetWikiArticleInput,
            handler=_get_wiki_article,
            categories=cats(CAT_HELP),
        )
    )
