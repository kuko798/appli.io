"""
Company intel API: DuckDuckGo search + OpenAI-compatible chat (default: pytorch_chat_server :8000).

Run: cd company_intel && pip install -r requirements.txt && py -3 server.py

Env:
  APPLI_COMPANY_INTEL_PORT (default 8780)
  APPLI_INTEL_CHAT_BASE_URL (default http://127.0.0.1:8000)
  APPLI_INTEL_CHAT_MODEL (default Qwen/Qwen2.5-1.5B-Instruct)
  APPLI_INTEL_CHAT_API_KEY (optional)
  APPLI_INTEL_MAX_TOKENS (default 640), APPLI_INTEL_MAX_TOKENS_FAST (default 440)
  APPLI_INTEL_CHAT_TIMEOUT_SEC (default 300)
  APPLI_INTEL_SEARCH_RESULTS (default 3), APPLI_INTEL_CONTEXT_CHARS (default 3200)
  APPLI_INTEL_DDGS_BACKEND (default duckduckgo), APPLI_INTEL_DDGS_TIMEOUT_SEC (default 12)
"""

from __future__ import annotations

import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field

from pipeline import run_intel, run_request

PORT = int(os.environ.get("APPLI_COMPANY_INTEL_PORT", "8780"))
HOST = os.environ.get("APPLI_COMPANY_INTEL_HOST", "0.0.0.0")

app = FastAPI(title="Appli.io company intel", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class CompanyIntelBody(BaseModel):
    company: str | None = Field(default=None, description="Employer name")
    title: str | None = Field(default=None, description="Role / job title")
    temperature: float = 0.5
    fast: bool = Field(
        default=True,
        description="Fewer search hits + shorter prompt + lower max_tokens (recommended on CPU)",
    )
    firstMessagePreview: str | None = Field(
        default=None,
        description="Optional; extract company via on \"...\" pattern (LocalLLM-style debug field)",
    )


class LegacyRunBody(BaseModel):
    """Same fields as CompanyIntelBody plus arbitrary keys for run_request."""

    model_config = ConfigDict(extra="allow")

    temperature: float = 0.5
    firstMessagePreview: str | None = None
    company: str | None = None
    title: str | None = None


@app.get("/health")
def health():
    return {"status": "ok", "service": "company_intel"}


@app.post("/company-intel")
def company_intel(body: CompanyIntelBody):
    try:
        text = run_intel(
            company=(body.company or "").strip(),
            title=(body.title or "a candidate").strip(),
            temperature=body.temperature,
            fast=body.fast,
        )
        return {"report": text}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@app.post("/company-intel/run-request")
def company_intel_run_request(body: LegacyRunBody):
    """Compatibility: body shaped like LocalLLM log payload."""
    try:
        text = run_request(body.model_dump(exclude_none=True))
        return {"report": text}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=HOST, port=PORT, log_level="info")
