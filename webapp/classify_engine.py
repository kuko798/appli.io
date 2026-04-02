"""
Email classification: optional Ollama (local) + rules fallback (same as python_classifier/service).
"""
from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request
from typing import Any

from rules import classify_rules_only

OLLAMA_MODEL = os.environ.get("APPLI_OLLAMA_MODEL", "").strip()
OLLAMA_HOST = os.environ.get("APPLI_OLLAMA_HOST", "http://127.0.0.1:11434").rstrip("/")
MAX_BODY = 2200

CLASSIFY_PROMPT = """You are a recruiting email classifier. Return ONLY valid JSON with keys:
status, role, company, reason, confidence, signals, nextAction, summary.

status: one of "Applied", "Interview", "Offer", "Rejected", or null (JSON null for newsletters/non-application mail).
role, company, reason, nextAction, summary: string or null.
confidence: number 0-1.
signals: array of up to 4 short strings (evidence).

Rules: newsletters => null. "Other candidate" offer => Rejected. Polite rejections still Rejected.

Subject:
{subject}

Body:
{body}
"""


def _ollama_chat(subject: str, body: str) -> dict[str, Any]:
    body_text = (body or "")[:MAX_BODY]
    if len(body or "") > MAX_BODY:
        body_text += "\n...[truncated]"
    content = CLASSIFY_PROMPT.format(subject=subject or "", body=body_text)
    payload = {
        "model": OLLAMA_MODEL,
        "stream": False,
        "format": "json",
        "options": {"temperature": 0},
        "messages": [{"role": "user", "content": content}],
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{OLLAMA_HOST}/api/chat",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        raw = json.loads(resp.read().decode("utf-8"))
    msg = (raw.get("message") or {}).get("content") or ""
    msg = msg.strip()
    msg = re.sub(r"^```(?:json)?\s*", "", msg, flags=re.I)
    msg = re.sub(r"\s*```$", "", msg).strip()
    parsed = json.loads(msg)
    parsed["source"] = "ollama"
    return parsed


def _normalize(raw: dict[str, Any]) -> dict[str, Any]:
    st = raw.get("status")
    if isinstance(st, str) and st.lower() == "null":
        st = None
    if st is not None and st not in ("Applied", "Interview", "Offer", "Rejected"):
        st = None
    signals = raw.get("signals")
    if not isinstance(signals, list):
        signals = []
    signals = [str(s) for s in signals if s][:4]
    try:
        c = max(0.0, min(1.0, float(raw.get("confidence"))))
    except (TypeError, ValueError):
        c = 0.72

    def sval(k: str) -> str | None:
        v = raw.get(k)
        if v is None or (isinstance(v, str) and not v.strip()):
            return None
        return str(v).strip()

    return {
        "status": st,
        "role": sval("role"),
        "company": sval("company"),
        "reason": sval("reason"),
        "confidence": c,
        "signals": signals,
        "nextAction": sval("nextAction"),
        "summary": sval("summary"),
    }


def classify_email(subject: str, body: str) -> dict[str, Any]:
    if OLLAMA_MODEL:
        try:
            return _normalize(_ollama_chat(subject, body))
        except (
            urllib.error.URLError,
            urllib.error.HTTPError,
            json.JSONDecodeError,
            TimeoutError,
            KeyError,
            ValueError,
        ) as e:
            rules = classify_rules_only(subject, body)
            rules["reason"] = f"{rules.get('reason') or 'Rules fallback.'} (Ollama: {str(e)[:100]})"
            return _normalize(rules)
    return _normalize(classify_rules_only(subject, body))
