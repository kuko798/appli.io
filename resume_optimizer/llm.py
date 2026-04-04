from __future__ import annotations

import json
import os
from typing import Any, List, Optional

import httpx

# ⚡ Lower timeout (huge UX improvement)
DEFAULT_TIMEOUT = float(os.environ.get("RESUME_OPTIMIZER_TIMEOUT", "15"))

DEFAULT_BASE = os.environ.get(
    "RESUME_OPTIMIZER_BASE_URL", "http://127.0.0.1:8000"
).rstrip("/")

DEFAULT_MODEL = os.environ.get("RESUME_OPTIMIZER_MODEL", "").strip()
DEFAULT_API_KEY = os.environ.get("RESUME_OPTIMIZER_API_KEY", "").strip()


# ✅ GLOBAL CLIENT (connection pooling = faster)
_client = httpx.Client(
    timeout=DEFAULT_TIMEOUT,
    limits=httpx.Limits(max_keepalive_connections=20, max_connections=50),
)


def _headers() -> dict[str, str]:
    h = {"Content-Type": "application/json"}
    if DEFAULT_API_KEY:
        h["Authorization"] = f"Bearer {DEFAULT_API_KEY}"
    return h


def chat_completion(
    messages: List[dict[str, str]],
    *,
    temperature: float = 0.3,
    max_tokens: int = 512,  # ⚡ reduced from 1024
    model: Optional[str] = None,
    response_format: Optional[dict[str, Any]] = None,
    base_url: Optional[str] = None,
) -> str:
    """
    Fast OpenAI-compatible chat completion
    """

    url = f"{(base_url or DEFAULT_BASE).rstrip('/')}/v1/chat/completions"

    body: dict[str, Any] = {
        "model": model or DEFAULT_MODEL or "local",
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": False,
    }

    if response_format is not None:
        body["response_format"] = response_format

    # ✅ retry logic (prevents random slow failures)
    for attempt in range(2):
        try:
            r = _client.post(url, headers=_headers(), json=body)
            r.raise_for_status()
            data = r.json()

            return (data["choices"][0]["message"]["content"] or "").strip()

        except Exception as e:
            if attempt == 1:
                raise RuntimeError(f"LLM request failed: {e}")
            # retry once


def chat_completion_json(
    messages: List[dict[str, str]],
    *,
    temperature: float = 0.2,
    max_tokens: int = 400,  # ⚡ reduced
    model: Optional[str] = None,
    base_url: Optional[str] = None,
) -> dict[str, Any]:
    content = chat_completion(
        messages,
        temperature=temperature,
        max_tokens=max_tokens,
        model=model,
        base_url=base_url,
        response_format={"type": "json_object"},
    )

    try:
        return json.loads(content)

    except json.JSONDecodeError:
        # Strip markdown fences (common LLM issue)
        t = content.strip()
        if t.startswith("```"):
            t = t.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

        return json.loads(t)