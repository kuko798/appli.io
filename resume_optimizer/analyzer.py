from __future__ import annotations

from typing import Any, Optional

from .llm import chat_completion_json
from .models import BulletScore


def _default_score() -> BulletScore:
    return BulletScore(
        impact=5,
        clarity=5,
        specificity=5,
        has_metrics=False,
        suggestions=["Tighten wording and add concrete scope or outcomes already implied by the bullet."],
    )


def analyze_bullet(
    bullet: str,
    *,
    model: Optional[str] = None,
    base_url: Optional[str] = None,
) -> BulletScore:
    system = (
        "You score resume bullets for any profession (healthcare, sales, teaching, trades, engineering, etc.). "
        "Return ONLY a JSON object with keys: impact (0-10 int), clarity (0-10 int), specificity (0-10 int, role-relevant detail), "
        "has_metrics (boolean), suggestions (array of short strings, max 4). "
        "Do not invent facts about the candidate; score the text as written."
    )
    user = f"Bullet:\n{bullet.strip()[:2000]}"
    try:
        raw: dict[str, Any] = chat_completion_json(
            [{"role": "system", "content": system}, {"role": "user", "content": user}],
            temperature=0.15,
            max_tokens=400,
            model=model,
            base_url=base_url,
        )
    except (ValueError, RuntimeError, TypeError, KeyError):
        return _default_score()

    try:
        sug = raw.get("suggestions") or []
        if not isinstance(sug, list):
            sug = [str(sug)]
        return BulletScore(
            impact=max(0, min(10, int(raw.get("impact", 5)))),
            clarity=max(0, min(10, int(raw.get("clarity", 5)))),
            specificity=max(0, min(10, int(raw.get("specificity", raw.get("technical_depth", 5))))),
            has_metrics=bool(raw.get("has_metrics", False)),
            suggestions=[str(s)[:200] for s in sug if s][:4],
        )
    except (TypeError, ValueError):
        return _default_score()
