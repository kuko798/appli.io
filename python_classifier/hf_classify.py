"""
Hugging Face Inference API classifier — uses classifier_models for config + JSON discipline.

Env:
  APPLI_HF_MODEL — required when this module is invoked
  HF_TOKEN / HUGGING_FACE_HUB_TOKEN / APPLI_HF_TOKEN
  APPLI_MAX_BODY_CHARS, APPLI_HF_MAX_TOKENS, APPLI_JSON_PARSE_RETRIES, APPLI_HF_JSON_FIX_TURNS, APPLI_LLM_TEMPERATURE

https://huggingface.co/docs/huggingface_hub/guides/inference
"""
from __future__ import annotations

import json
from typing import Any

from classifier_models import ClassifierLLMConfig, parse_classification_json

CLASSIFY_SYSTEM = """You classify recruiting and job-application emails for a candidate's inbox.
Reply with a single JSON object only (no markdown fences, no commentary). Required keys:
status, role, company, reason, confidence, signals, nextAction, summary.

status: one of "Applied", "Assessment", "Interview", "Offer", "Rejected", or JSON null.
- null: newsletters, marketing, job digests, not about this person's applications.
- Applied: application received / thank-you-for-applying (not rejected in same email).
- Assessment: take-home / CoderPad / HackerRank / CodeSignal style, not live interview scheduling.
- Interview: scheduling, phone screen, interview invites.
- Offer: offer or compensation (if another candidate got the role → Rejected).
- Rejected: not moving forward, other candidates chosen, etc.

company: employer they applied to — prefer body/subject over ATS From (Greenhouse, Lever, Workday, Ashby, Paylocity, Gem).
role: job title or program if obvious; else null.
signals: array of up to 4 short evidence strings.
confidence: number 0–1."""


def _user_block(subject: str, body: str, from_header: str, max_body: int) -> str:
    body_text = (body or "")[:max_body]
    if body and len(body) > max_body:
        body_text += "\n...[truncated]"
    from_line = (from_header or "").strip()[:500] or "(not provided)"
    return f"""Subject:
{subject or ""}

Body:
{body_text}

From:
{from_line}"""


def _message_content(completion: Any) -> str:
    if completion is None:
        return ""
    choices = getattr(completion, "choices", None) or completion.get("choices", [])
    if not choices:
        return ""
    ch0 = choices[0]
    msg = getattr(ch0, "message", None) or ch0.get("message", {})
    if msg is None:
        return ""
    return (getattr(msg, "content", None) or msg.get("content") or "").strip()


def classify_with_hf(subject: str, body: str, from_header: str = "") -> dict[str, Any]:
    import os

    from huggingface_hub import InferenceClient

    model = (os.environ.get("APPLI_HF_MODEL") or "").strip()
    if not model:
        raise RuntimeError("APPLI_HF_MODEL is not set")

    cfg = ClassifierLLMConfig.from_env()
    token = (
        os.environ.get("HF_TOKEN", "").strip()
        or os.environ.get("HUGGING_FACE_HUB_TOKEN", "").strip()
        or os.environ.get("APPLI_HF_TOKEN", "").strip()
        or None
    )

    client = InferenceClient(model=model, token=token)
    user_content = _user_block(subject, body, from_header, cfg.max_body_chars)
    messages: list[dict[str, str]] = [
        {"role": "system", "content": CLASSIFY_SYSTEM},
        {"role": "user", "content": user_content},
    ]

    last_text = ""
    last_error: Exception | None = None

    for attempt in range(cfg.json_parse_retries):
        completion = client.chat_completion(
            messages=messages,
            max_tokens=cfg.max_tokens,
            temperature=cfg.temperature,
        )
        last_text = _message_content(completion)
        try:
            parsed = parse_classification_json(last_text)
            parsed["source"] = "python_huggingface"
            return parsed
        except (json.JSONDecodeError, ValueError) as e:
            last_error = e
            if attempt + 1 >= cfg.json_parse_retries or cfg.hf_retry_messages < 1:
                break
            # Second turn: ask for repair only (Claw-style structured retry discipline)
            fix_user = (
                "Your previous reply was not valid JSON or was not a single object. "
                "Reply with ONLY one JSON object, no markdown. Keys: "
                "status, role, company, reason, confidence, signals, nextAction, summary.\n\n"
                f"Broken output (truncated):\n{last_text[:1200]}"
            )
            messages = list(messages)
            messages.append({"role": "assistant", "content": last_text[:4000]})
            messages.append({"role": "user", "content": fix_user})

    raise ValueError(f"HF classification JSON parse failed: {last_error}; snippet={last_text[:200]!r}")
