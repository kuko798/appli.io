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


def build_intel_prompt(company: str, title: str, context: str, *, fast: bool) -> str:
    ctx = context.strip() or "(No web snippets returned; answer from general knowledge and say so under Recent News.)"
    if fast:
        return f"""Career intel on "{company}" for someone applying as "{title}". Be brief (under ~280 words). Plain headers, no markdown fences.

Company Summary
2-3 sentences: what the company does, who they sell to or serve, and their space (e.g. enterprise SaaS, fintech). Mention scale or stage only if the snippets support it.

Hiring & Workforce Trends
3-4 short bullets: hiring pace, types of roles in demand, remote/hybrid signals, hiring freezes or layoffs, or internships/new grad programs—only what the snippets support. If there is no hiring signal, say "No clear hiring signal in search results."

Culture & Values
2 bullets max.

Recent News
2 bullets from the web context only; if thin, one honest line.

Interview Tips
3 very short bullets tailored to this company.

Risk vs Reward
2 sentences.

--- Web snippets ---
{ctx}
"""
    return f"""You are a career research assistant. Write a concise intel report on "{company}" for someone applying as "{title}".
Be direct: tight sentences or bullets. Target under 450 words. Use plain section headers (no brackets).

Company Summary
3-5 sentences: core business, products or services, target customers, and market position. Include company stage or scale (startup, public, headcount hints) only when supported by the snippets or well-known facts; otherwise stay general.

Hiring & Workforce Trends
A short paragraph or 4-5 bullets covering: whether hiring appears active or constrained, kinds of roles mentioned (engineering, sales, etc.), location or remote/hybrid patterns, notable layoffs or hiring freezes, university or internship programs. Ground claims in the web context; if hiring information is missing, say so explicitly.

Culture & Values
2-4 bullets or one short paragraph.

Recent News
2-4 bullets from the web context below; if the context is thin, say so briefly.

Interview Tips
3 specific, actionable bullets.

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
    fast: bool = False,
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

    if fast:
        search_max_results = min(search_max_results, 2)
        context_max_chars = min(context_max_chars, 1600)
        temperature = min(temperature, 0.28)
        max_syn = int(os.environ.get("APPLI_INTEL_MAX_TOKENS_FAST", "440"))
    else:
        max_syn = int(os.environ.get("APPLI_INTEL_MAX_TOKENS", "640"))

    q = f"{company} company overview hiring jobs layoffs remote work culture news"
    context = search_web(q, max_results=search_max_results)
    if len(context) > context_max_chars:
        context = context[:context_max_chars].rstrip() + "\n…[context truncated]"
    prompt = build_intel_prompt(company, title, context, fast=fast)
    return synthesize_report(prompt, temperature=temperature, max_tokens=max_syn)


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

    fast = bool(body.get("fast", False))
    return run_intel(company=company, title=title, temperature=temp, fast=fast)
