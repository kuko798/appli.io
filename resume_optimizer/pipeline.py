from __future__ import annotations

from typing import Optional, Union
import json
from difflib import SequenceMatcher

from .llm import chat_completion
from .models import BulletInput, BulletOutput, BulletScore


def rewrite_bullet(
    bullet_input: Union[BulletInput, dict],
    *,
    model: Optional[str] = None,
    base_url: Optional[str] = None,
    skip_score: bool = False,  # kept for compatibility
) -> BulletOutput:
    """
    Optimized pipeline:
    - Single LLM call
    - Anti-copy detection
    - Auto-retry if output is weak
    """

    # Normalize input
    if isinstance(bullet_input, dict):
        bullet_input = BulletInput.model_validate(bullet_input)

    bullet = bullet_input.text.strip()
    if not bullet:
        raise ValueError("bullet text is empty")

    # ---------- PROMPT ----------
    prompt = f"""
You are an expert resume optimizer.

Your job is to SIGNIFICANTLY IMPROVE the bullet, not lightly edit it.

STRICT RULES:
- You MUST rewrite the bullet using DIFFERENT wording and structure
- Do NOT copy phrases from the original unless absolutely necessary
- Each version must be clearly DISTINCT from the original
- If output is too similar, it is WRONG
- Focus on impact, clarity, and measurable results
- Add realistic metrics ONLY if they make sense

Return ONLY valid JSON:
{{
  "domain": "...",
  "score": {{
    "impact": 0-10,
    "clarity": 0-10,
    "specificity": 0-10,
    "has_metrics": true/false,
    "suggestions": []
  }},
  "improved_versions": [
    "...",
    "...",
    "..."
  ]
}}

GOOD transformation example:
Original: "Helped customers at front desk"
Better: "Assisted 50+ customers daily, resolving inquiries and improving service efficiency"

BAD output (DO NOT DO THIS):
- Copying the original sentence
- Changing only 1–2 words
- Reformatting without improving content

Guidelines:
- Use strong action verbs (engineered, led, optimized, implemented, delivered)
- Prioritize results and outcomes over tasks
- Keep each version under 25 words
- Tailor language to:
  Role: {bullet_input.role or "N/A"}
  Target Company: {bullet_input.target_company or "N/A"}
- Use job description context if useful:
  {bullet_input.job_description or "N/A"}

Bullet:
{bullet}
"""

    # ---------- FIRST CALL ----------
    response = chat_completion(
        [{"role": "user", "content": prompt}],
        temperature=0.3,
        max_tokens=300,
        model=model,
        base_url=base_url,
    )

    # ---------- HELPERS ----------
    def too_similar(original: str, rewritten: str) -> bool:
        ratio = SequenceMatcher(None, original.lower(), rewritten.lower()).ratio()
        return ratio > 0.75

    def parse_response(resp: str):
        data = json.loads(resp)

        score_data = data.get("score", {})
        score = BulletScore(
            impact=score_data.get("impact", 5),
            clarity=score_data.get("clarity", 5),
            specificity=score_data.get("specificity", 5),
            has_metrics=score_data.get("has_metrics", False),
            suggestions=score_data.get("suggestions", []),
        )

        versions = data.get("improved_versions", [])
        versions = [v.strip() for v in versions if v.strip()]

        while len(versions) < 3:
            versions.append(versions[-1] if versions else bullet)

        return data.get("domain", "General"), versions[:3], score

    # ---------- PARSE FIRST RESPONSE ----------
    try:
        domain, versions, score = parse_response(response)

        # ---------- ANTI-COPY CHECK ----------
        if any(too_similar(bullet, v) for v in versions):
            retry_prompt = prompt + "\n\nIMPORTANT: Your previous answer was too similar. Rewrite more aggressively with different wording."

            retry_response = chat_completion(
                [{"role": "user", "content": retry_prompt}],
                temperature=0.5,  # higher = more variation
                max_tokens=300,
                model=model,
                base_url=base_url,
            )

            try:
                domain, versions, score = parse_response(retry_response)
            except Exception:
                pass  # fallback to first result if retry fails

        return BulletOutput(
            domain=domain,
            improved_versions=versions,
            score=score,
        )

    except Exception:
        # ---------- FAILSAFE ----------
        return BulletOutput(
            domain="General",
            improved_versions=[bullet, bullet, bullet],
            score=BulletScore(
                impact=5,
                clarity=5,
                specificity=5,
                has_metrics=False,
                suggestions=["Parsing failed, fallback used"],
            ),
        )