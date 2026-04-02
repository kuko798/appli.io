"""Web search snippets via `ddgs` (single backend by default — faster than backend=auto)."""

from __future__ import annotations

import logging
import os
from typing import Any

log = logging.getLogger(__name__)

_SNIPPET_MAX = 280
# One engine avoids metasearch fan-out across Bing/Brave/Google/etc. Use "auto" if you need more coverage.
_DEFAULT_BACKEND = (os.environ.get("APPLI_INTEL_DDGS_BACKEND") or "duckduckgo").strip() or "duckduckgo"
_DDGS_TIMEOUT = int(os.environ.get("APPLI_INTEL_DDGS_TIMEOUT_SEC", "12"))


def _lines_from_results(results: list[dict[str, Any]]) -> list[str]:
    lines: list[str] = []
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
    return lines


def search_web(query: str, max_results: int = 5, *, backend: str | None = None) -> str:
    """
    Return newline-joined snippet bodies from text search.
    """
    # PyPI package renamed: use `ddgs`, not deprecated `duckduckgo_search`.
    from ddgs import DDGS

    be = (backend or _DEFAULT_BACKEND).strip() or "duckduckgo"
    lines: list[str] = []
    try:
        with DDGS(timeout=_DDGS_TIMEOUT) as ddgs:
            results: list[dict[str, Any]] = list(
                ddgs.text(query, max_results=max_results, backend=be)
            )
        lines = _lines_from_results(results)
    except Exception as e:
        log.warning("Web search failed (backend=%s): %s", be, e)
        if be != "auto":
            try:
                with DDGS(timeout=_DDGS_TIMEOUT) as ddgs:
                    results = list(ddgs.text(query, max_results=max_results, backend="auto"))
                lines = _lines_from_results(results)
            except Exception as e2:
                log.warning("Web search auto fallback failed: %s", e2)
                return ""
        else:
            return ""

    return "\n".join(lines)
