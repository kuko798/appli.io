"""Extract plain text body from Gmail API message payload."""
from __future__ import annotations

import base64
from typing import Any


def _find_plain(part: dict[str, Any]) -> str:
    if part.get("mimeType") == "text/plain" and part.get("body", {}).get("data"):
        return part["body"]["data"]
    for sub in part.get("parts") or []:
        got = _find_plain(sub)
        if got:
            return got
    return ""


def extract_body_from_payload(payload: dict[str, Any]) -> str:
    raw = ""
    if payload.get("body", {}).get("data"):
        raw = payload["body"]["data"]
    else:
        raw = _find_plain(payload)
    if not raw:
        return ""
    raw = raw.replace("-", "+").replace("_", "/")
    try:
        return base64.b64decode(raw).decode("utf-8", errors="replace")
    except Exception:
        return ""


def header(headers: list[dict[str, str]], name: str) -> str:
    for h in headers or []:
        if (h.get("name") or "").lower() == name.lower():
            return h.get("value") or ""
    return ""
