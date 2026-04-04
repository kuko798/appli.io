"""
Classifier API for the web app (Gmail sync / email labels). Optional Gmail OAuth server: see ../webapp/.

Run:
  pip install -r requirements.txt
  python service.py

Bind (e.g. Docker): APPLI_CLASSIFIER_HOST=0.0.0.0 APPLI_CLASSIFIER_PORT=8765

Optional Hugging Face Inference (hosted models via huggingface_hub):
  set APPLI_HF_MODEL=meta-llama/Llama-3.2-3B-Instruct
  set HF_TOKEN=hf_...  (or HUGGING_FACE_HUB_TOKEN / APPLI_HF_TOKEN)

Optional local LLM (Ollama):
  set APPLI_OLLAMA_MODEL=llama3.2
  set APPLI_OLLAMA_HOST=http://127.0.0.1:11434

Optional tuning (shared LLM discipline, see classifier_models.py):
  APPLI_MAX_BODY_CHARS, APPLI_HF_MAX_TOKENS, APPLI_JSON_PARSE_RETRIES,
  APPLI_HF_JSON_FIX_TURNS, APPLI_LLM_TEMPERATURE

Order: Hugging Face (if APPLI_HF_MODEL set) -> else Ollama -> else rules.py.
LLM failures fall back to rules. Missing company after LLM uses rules.extract_company when possible.

Harness-style patterns (explicit config + structured JSON) align with projects such as
https://github.com/ultraworkers/claw-code — adapted here for email classification only.
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from classifier_models import ClassifierLLMConfig, normalize_classification_dict, parse_classification_json
from rules import classify_rules_only, extract_company

try:
    from hf_classify import classify_with_hf
except ImportError:
    classify_with_hf = None  # type: ignore[misc, assignment]

app = FastAPI(title="Appli.io Python classifier")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OLLAMA_MODEL = os.environ.get("APPLI_OLLAMA_MODEL", "").strip()
OLLAMA_HOST = os.environ.get("APPLI_OLLAMA_HOST", "http://127.0.0.1:11434").rstrip("/")
HF_MODEL = os.environ.get("APPLI_HF_MODEL", "").strip()

_llm_cfg = ClassifierLLMConfig.from_env()
MAX_BODY = _llm_cfg.max_body_chars

CLASSIFY_PROMPT = """You are a recruiting email classifier. Return ONLY valid JSON with keys:
status, role, company, reason, confidence, signals, nextAction, summary.

status: one of "Applied", "Assessment", "Interview", "Offer", "Rejected", or null (JSON null for newsletters/non-application mail).
Use "Assessment" for coding challenges, CoderPad/CodeSignal/HackerRank take-homes, and similar async tests — not for live interview scheduling.
role, company, reason, nextAction, summary: string or null.
confidence: number 0-1.
signals: array of up to 4 short strings (evidence).

Rules: newsletters => null. "Other candidate" offer => Rejected. Polite rejections still Rejected.
Use the From line to infer employer (company) when the domain is corporate (e.g. name@chewy.com => Chewy).

Subject:
{subject}

Body:
{body}

From:
{from_line}
"""


def _ollama_chat(subject: str, body: str, from_header: str = "") -> dict[str, Any]:
    body_text = (body or "")[:MAX_BODY]
    if len(body or "") > MAX_BODY:
        body_text += "\n...[truncated]"
    from_line = (from_header or "").strip()[:500] or "(not provided)"
    content = CLASSIFY_PROMPT.format(subject=subject or "", body=body_text, from_line=from_line)
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
    parsed = parse_classification_json(msg)
    parsed["source"] = "python_ollama"
    return parsed


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "ok": "true",
        "huggingface": HF_MODEL or "off",
        "ollama": OLLAMA_MODEL or "off",
    }


def _enrich_company(out: dict[str, Any], subject: str, body: str, from_header: str) -> dict[str, Any]:
    if not (out.get("company") or "").strip():
        c = extract_company(subject, body, from_header)
        if c:
            out["company"] = c
    return out


@app.post("/classify")
def classify(payload: dict[str, Any]) -> dict[str, Any]:
    subject = payload.get("subject") or ""
    body = payload.get("body") or ""
    from_header = str(payload.get("from") or payload.get("fromHeader") or "").strip()

    if HF_MODEL and classify_with_hf is not None:
        try:
            out = _normalize_out(classify_with_hf(subject, body, from_header))
            return _enrich_company(out, subject, body, from_header)
        except Exception as e:
            rules = classify_rules_only(subject, body, from_header)
            err = str(e)[:160]
            rules["reason"] = f"{rules.get('reason') or 'Rules fallback.'} (Hugging Face error: {err})"
            rules["source"] = "python_rules"
            return _normalize_out(_enrich_company(rules, subject, body, from_header))

    if OLLAMA_MODEL:
        try:
            out = _normalize_out(_ollama_chat(subject, body, from_header))
            return _enrich_company(out, subject, body, from_header)
        except (urllib.error.URLError, urllib.error.HTTPError, json.JSONDecodeError, TimeoutError, KeyError, ValueError) as e:
            rules = classify_rules_only(subject, body, from_header)
            err = str(e)[:120]
            rules["reason"] = f"{rules.get('reason') or 'Rules fallback.'} (Ollama error: {err})"
            return _normalize_out(_enrich_company(rules, subject, body, from_header))

    return _normalize_out(classify_rules_only(subject, body, from_header))


def _normalize_out(raw: dict[str, Any]) -> dict[str, Any]:
    return normalize_classification_dict(raw)


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("APPLI_CLASSIFIER_PORT", "8765"))
    host = os.environ.get("APPLI_CLASSIFIER_HOST", "127.0.0.1").strip() or "127.0.0.1"
    uvicorn.run(app, host=host, port=port)
