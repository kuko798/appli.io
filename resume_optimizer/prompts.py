from __future__ import annotations

from typing import Optional

# Truthfulness and tone ideas aligned with https://github.com/srbhr/Resume-Matcher (Apache-2.0).
RESUME_MATCHER_STYLE_RULES = (
    "Weave job-description vocabulary only where the source bullet already supports it; "
    "do not add skills, tools, or metrics that are not implied by the original. "
    "Prefer plain verbs (led, built, used) over flashy resume clichés unless the source uses them. "
    "Avoid em-dashes; use commas or periods."
)

DOMAIN_GUIDANCE = {
    "Engineering": "Emphasize systems, tools, reliability, scale, and measurable technical outcomes only if supported by the source text.",
    "Sales": "Emphasize revenue, pipeline, clients, growth, and quotas only when plausible from the bullet.",
    "Healthcare": "Emphasize patient care, safety, compliance, volume, and clinical context without violating privacy (no invented PHI).",
    "Education": "Emphasize student outcomes, instruction, curriculum, and engagement grounded in the bullet.",
    "Marketing": "Emphasize campaigns, channels, engagement, and conversions only if consistent with the bullet.",
    "Operations": "Emphasize efficiency, process, cost, quality, and throughput supported by the bullet.",
    "General": "Emphasize clear action, scope, and measurable or qualitative impact that honestly reflects the bullet.",
}


def build_rewrite_prompt(
    bullet: str,
    domain: str,
    *,
    role: Optional[str] = None,
    company: Optional[str] = None,
    job_description: Optional[str] = None,
) -> str:
    extra = DOMAIN_GUIDANCE.get(domain, DOMAIN_GUIDANCE["General"])
    jd_block = ""
    if job_description and job_description.strip():
        jd_block = (
            "\nOptional target role context (mirror vocabulary naturally; do not claim experience not implied by the bullet):\n"
            f"{job_description.strip()[:2500]}\n"
        )

    return f"""Rewrite this resume bullet for maximum clarity and professional impact. The candidate may be in ANY field.

Rules:
- {RESUME_MATCHER_STYLE_RULES}
- Strong action verb + what they did + how + outcome when the source supports it.
- Do NOT invent numbers, percentages, dollar amounts, rankings, or employer metrics. If the bullet has no numbers, improve wording only; you may use qualitative scope (e.g. "cross-functional team", "high-volume shift") when clearly implied.
- Do NOT add tools, certifications, or job duties not implied by the original bullet.
- Keep each version one line, under 220 characters, no markdown bullets in the line text.

Domain focus ({domain}): {extra}

Context:
- Role title (if known): {role or "N/A"}
- Target employer (if known): {company or "N/A"}
{jd_block}
Original bullet:
{bullet.strip()}

Output exactly 3 versions in this format (labels required):
1. Concise: <single line>
2. Impact: <single line>
3. Professional: <single line>
"""


def build_full_resume_system_prompt() -> str:
    """Optional: same principles as the React optimizer, for server-side full-resume passes."""
    return (
        "You are an ATS-aware resume editor for candidates in any profession (clinical, education, sales, trades, engineering, etc.). "
        "Preserve facts; improve structure and wording; do not invent metrics. "
        + RESUME_MATCHER_STYLE_RULES
    )
