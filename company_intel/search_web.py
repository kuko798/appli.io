"""DuckDuckGo text search only (no LLM)."""

from __future__ import annotations

import logging
from typing import Any

log = logging.getLogger(__name__)

_SNIPPET_MAX = 320


def search_web(query: str, max_results: int = 5) -> str:
    """
    Return newline-joined snippet bodies from DDG text results.
    """
    # PyPI package renamed: use `ddgs`, not deprecated `duckduckgo_search`.
    from ddgs import DDGS

    lines: list[str] = []
    try:
        with DDGS() as ddgs:
            results: list[dict[str, Any]] = list(
                ddgs.text(query, max_results=max_results)
            )
        for r in results:
            body = (r.get("body") or "").strip()
            title = (r.get("title") or "").strip()
            if len(body) > _SNIPPET_MAX:
                body = body[:_SNIPPET_MAX].rstrip() + "…"
            if body:
                if title:
                    t = title if len(title) <= 120 else title[:117] + "…"
                    lines.append(f"{t}: {body}")
                else:
                    lines.append(body)
    except Exception as e:
        log.warning("DuckDuckGo search failed: %s", e)
        return ""

    return "\n".join(lines)
