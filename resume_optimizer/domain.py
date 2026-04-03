from __future__ import annotations

from typing import Optional

from .llm import chat_completion

DOMAINS = [
    "Engineering",
    "Sales",
    "Healthcare",
    "Education",
    "Marketing",
    "Operations",
    "General",
]


def _normalize_domain(raw: str) -> str:
    t = raw.strip().strip(".").strip('"').strip("'")
    for d in DOMAINS:
        if t.lower() == d.lower():
            return d
    # Prefix match e.g. "Engineering — software"
    low = t.lower()
    for d in DOMAINS:
        if low.startswith(d.lower()):
            return d
    return "General"


def detect_domain(bullet: str, *, model: Optional[str] = None, base_url: Optional[str] = None) -> str:
    system = (
        "You classify resume bullets into exactly one career domain. "
        f"Valid labels: {', '.join(DOMAINS)}. "
        "Reply with ONLY the label word(s) from that list, nothing else."
    )
    user = f"Bullet:\n{bullet.strip()[:1200]}"
    out = chat_completion(
        [{"role": "system", "content": system}, {"role": "user", "content": user}],
        temperature=0.1,
        max_tokens=32,
        model=model,
        base_url=base_url,
    )
    first_line = out.splitlines()[0] if out else ""
    return _normalize_domain(first_line or out)
