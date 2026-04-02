"""
Synthesis step: OpenAI-compatible POST /v1/chat/completions (e.g. pytorch_chat_server).

Env:
  APPLI_INTEL_CHAT_BASE_URL  default http://127.0.0.1:8000
  APPLI_INTEL_CHAT_MODEL     default Qwen/Qwen2.5-1.5B-Instruct
  APPLI_INTEL_CHAT_API_KEY   optional Bearer token
"""

from __future__ import annotations

import os
import re

import requests

DEFAULT_BASE = os.environ.get("APPLI_INTEL_CHAT_BASE_URL", "http://127.0.0.1:8000").rstrip("/")
DEFAULT_MODEL = os.environ.get("APPLI_INTEL_CHAT_MODEL", "Qwen/Qwen2.5-1.5B-Instruct")
API_KEY = os.environ.get("APPLI_INTEL_CHAT_API_KEY", "").strip()
DEFAULT_MAX_TOKENS = int(os.environ.get("APPLI_INTEL_MAX_TOKENS", "640"))
DEFAULT_TIMEOUT_SEC = int(os.environ.get("APPLI_INTEL_CHAT_TIMEOUT_SEC", "300"))


def _completions_url(base: str) -> str:
    b = base.rstrip("/")
    if re.search(r"/v\d+$", b, re.I):
        return f"{b}/chat/completions"
    return f"{b}/v1/chat/completions"


def synthesize_report(
    prompt: str,
    *,
    temperature: float = 0.5,
    max_tokens: int | None = None,
    timeout_sec: int | None = None,
    model: str | None = None,
) -> str:
    url = _completions_url(DEFAULT_BASE)
    headers = {"Content-Type": "application/json"}
    if API_KEY:
        headers["Authorization"] = f"Bearer {API_KEY}"

    mt = DEFAULT_MAX_TOKENS if max_tokens is None else max_tokens
    to = DEFAULT_TIMEOUT_SEC if timeout_sec is None else timeout_sec
    body = {
        "model": model or DEFAULT_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": temperature,
        "max_tokens": mt,
        "stream": False,
    }
    r = requests.post(url, json=body, headers=headers, timeout=to)
    r.raise_for_status()
    data = r.json()
    choice0 = (data.get("choices") or [None])[0] or {}
    msg = choice0.get("message") or {}
    content = (msg.get("content") or "").strip()
    if not content:
        raise RuntimeError("Chat API returned empty content")
    return content
