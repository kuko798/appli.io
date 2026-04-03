from __future__ import annotations

import re
from typing import List


def parse_rewrite_versions(response: str, *, max_versions: int = 3) -> List[str]:
    text = (response or "").strip()
    if not text:
        return []

    found: list[str] = []
    lines = text.splitlines()
    for line in lines:
        line = line.strip()
        if not line:
            continue
        m = re.match(r"^\s*(\d+)\.\s*(?:Concise|Impact|Professional)\s*:\s*(.+)$", line, re.I)
        if m:
            found.append(m.group(2).strip())
            continue
        m2 = re.match(r"^\s*\d+\.\s+(.+)$", line)
        if m2 and len(found) < max_versions:
            found.append(m2.group(1).strip())

    if len(found) >= max_versions:
        return found[:max_versions]

    # Fallback: numbered lines
    numbered = [re.sub(r"^\d+[\).\]]\s*", "", ln).strip() for ln in lines if re.match(r"^\s*\d+[\).\]]\s*\S", ln)]
    if len(numbered) >= 2:
        return numbered[:max_versions]

    # Last resort: non-empty lines (skip obvious labels)
    out: list[str] = []
    for ln in lines:
        t = ln.strip()
        if not t or t.lower().startswith(("here are", "sure,", "```")):
            continue
        if ":" in t[:40] and t.split(":", 1)[0].strip().isalpha() and len(t.split(":", 1)[0]) < 20:
            rest = t.split(":", 1)[1].strip()
            if rest:
                t = rest
        if t and t not in out:
            out.append(t)
        if len(out) >= max_versions:
            break
    return out[:max_versions]
