"""
Shared classification types and normalization (inspired by harness-style codebases like
ultraworkers/claw-code: explicit config dataclasses, structured JSON parsing, single normalize path).
"""
from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from typing import Any

VALID_STATUSES = frozenset({"Applied", "Assessment", "Interview", "Offer", "Rejected"})


@dataclass(frozen=True)
class ClassifierLLMConfig:
    """Tunable LLM classification parameters (env-overridable)."""

    max_body_chars: int
    max_tokens: int
    json_parse_retries: int
    hf_retry_messages: int  # extra chat rounds if JSON parse fails
    temperature: float

    @classmethod
    def from_env(cls) -> ClassifierLLMConfig:
        return cls(
            max_body_chars=max(400, int(os.environ.get("APPLI_MAX_BODY_CHARS", "2200"))),
            max_tokens=max(200, int(os.environ.get("APPLI_HF_MAX_TOKENS", "900"))),
            json_parse_retries=max(1, int(os.environ.get("APPLI_JSON_PARSE_RETRIES", "2"))),
            hf_retry_messages=max(0, int(os.environ.get("APPLI_HF_JSON_FIX_TURNS", "1"))),
            temperature=float(os.environ.get("APPLI_LLM_TEMPERATURE", "0")),
        )


def strip_json_fence(text: str) -> str:
    t = (text or "").strip()
    t = re.sub(r"^```(?:json)?\s*", "", t, flags=re.I)
    t = re.sub(r"\s*```$", "", t).strip()
    return t


def parse_classification_json(text: str) -> dict[str, Any]:
    """Parse model output into a dict; raises json.JSONDecodeError or ValueError on failure."""
    t = strip_json_fence(text)
    parsed = json.loads(t)
    if not isinstance(parsed, dict):
        raise ValueError("model output must be a JSON object")
    return parsed


def normalize_classification_dict(raw: dict[str, Any]) -> dict[str, Any]:
    """Canonical API response dict for rules, Ollama, and Hugging Face paths."""
    st = raw.get("status")
    if isinstance(st, str) and st.lower() == "null":
        st = None
    if st is not None and st not in VALID_STATUSES:
        st = None

    signals = raw.get("signals")
    if not isinstance(signals, list):
        signals = []
    signals = [str(s) for s in signals if s][:4]

    try:
        c = float(raw.get("confidence"))
        c = max(0.0, min(1.0, c))
    except (TypeError, ValueError):
        c = 0.72

    def sval(k: str) -> str | None:
        v = raw.get(k)
        if v is None:
            return None
        if isinstance(v, str) and not v.strip():
            return None
        return str(v).strip() if v else None

    out: dict[str, Any] = {
        "status": st,
        "role": sval("role"),
        "company": sval("company"),
        "reason": sval("reason"),
        "confidence": c,
        "signals": signals,
        "nextAction": sval("nextAction"),
        "summary": sval("summary"),
    }
    src = raw.get("source")
    if src:
        out["source"] = src
    return out
