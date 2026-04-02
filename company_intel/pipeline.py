"""
Orchestration: web search context + OpenAI-compatible chat synthesis.
Optional `run_request(body)` for bodies shaped like LocalLLM debug payloads.
"""

from __future__ import annotations

import os
import re
from typing import Any

from chat_client import synthesize_report
from search_web import search_web


def extract_company_from_preview(preview: str) -> str | None:
    m = re.search(r'on\s+"([^"]+)"', preview)
    if m:
        return m.group(1).strip()
    return None


def build_intel_prompt(company: str, title: str, context: str) -> str:
    ctx = context.strip() or "(No web snippets returned; answer from general knowledge and say so under Recent News.)"
    return f"""You are a career research assistant. Write a SHORT intel report on "{company}" for someone applying as "{title}".
Be direct: tight sentences or bullets. Target under 400 words total so the reply finishes quickly.

Use plain section headers (no brackets):

Executive Summary
2 sentences max: what they do and market position.

Culture & Values
2-4 bullets or one short paragraph.

Recent News
2-4 bullets from the web context below only; if context is thin, say so in one line.

Interview Tips
3 short actionable bullets.

Risk vs Reward
2-3 sentences.

--- Web search snippets (may be incomplete) ---
{ctx}
"""


def run_intel(
    *,
    company: str,
    title: str,
    temperature: float = 0.5,
    search_max_results: int | None = None,
    context_max_chars: int | None = None,
) -> str:
    company = (company or "").strip()
    title = (title or "a candidate").strip()
    if not company:
        raise ValueError("company is required")

    if search_max_results is None:
        search_max_results = int(os.environ.get("APPLI_INTEL_SEARCH_RESULTS", "3"))
    if context_max_chars is None:
        context_max_chars = int(os.environ.get("APPLI_INTEL_CONTEXT_CHARS", "3200"))

    q = f"{company} company culture hiring news"
    context = search_web(q, max_results=search_max_results)
    if len(context) > context_max_chars:
        context = context[:context_max_chars].rstrip() + "\n…[context truncated]"
    prompt = build_intel_prompt(company, title, context)
    return synthesize_report(prompt, temperature=temperature)


def run_request(body: dict[str, Any]) -> str:
    """
    Accepts optional firstMessagePreview (regex extract) or explicit company/title.
    """
    temp = float(body.get("temperature") or 0.5)
    company = (body.get("company") or "").strip()
    title = (body.get("title") or "").strip() or "a candidate"

    preview = (body.get("firstMessagePreview") or "").strip()
    if not company and preview:
        company = extract_company_from_preview(preview) or preview[:240].strip()

    if not company:
        raise ValueError("Could not determine company from request")

    return run_intel(company=company, title=title, temperature=temp)
