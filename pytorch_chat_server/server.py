"""
OpenAI-compatible HTTP API backed by Hugging Face Transformers + PyTorch.

Used by the extension's LocalLLM.generate / generateJSON (POST /v1/chat/completions).

Env:
  APPLI_PYTORCH_MODEL   Hugging Face model id (default: Qwen/Qwen2.5-1.5B-Instruct)
  APPLI_PYTORCH_HOST    Bind host (default: 0.0.0.0)
  APPLI_PYTORCH_PORT    Port (default: 8000)
  APPLI_PYTORCH_API_KEY If set, require Authorization: Bearer <key>
  HF_TOKEN              Optional, for gated models
  APPLI_PYTORCH_SDPA    1 (default) use PyTorch SDPA attention when supported; 0 to disable
  APPLI_PYTORCH_MAX_INPUT_TOKENS  Max prompt tokens (default 8192); longer prompts are tail-truncated
"""

from __future__ import annotations

import logging
import os
import time
import uuid
from threading import Lock

import torch
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool
from transformers import AutoModelForCausalLM, AutoTokenizer

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("pytorch_chat_server")

MODEL_ID = os.environ.get("APPLI_PYTORCH_MODEL", "Qwen/Qwen2.5-1.5B-Instruct").strip()
HOST = os.environ.get("APPLI_PYTORCH_HOST", "0.0.0.0").strip()
PORT = int(os.environ.get("APPLI_PYTORCH_PORT", "8000"))
API_KEY = os.environ.get("APPLI_PYTORCH_API_KEY", "").strip()

_tokenizer = None
_model = None
_model_lock = Lock()
_loaded_id: str | None = None


def _pick_dtype():
    if torch.cuda.is_available():
        if torch.cuda.is_bf16_supported():
            return torch.bfloat16
        return torch.float16
    return torch.float32


def load_model():
    global _tokenizer, _model, _loaded_id
    if _model is not None and _loaded_id == MODEL_ID:
        return
    log.info("Loading model %s (this may take a minute)...", MODEL_ID)
    tok = AutoTokenizer.from_pretrained(MODEL_ID)
    if tok.pad_token_id is None:
        tok.pad_token = tok.eos_token
    dtype = _pick_dtype()
    kwargs = {"torch_dtype": dtype}
    if torch.cuda.is_available():
        kwargs["device_map"] = "auto"
    _sdpa_raw = (os.environ.get("APPLI_PYTORCH_SDPA") or "1").strip().lower()
    sdpa = _sdpa_raw not in ("0", "false", "no", "off")
    load_kw = dict(kwargs)
    if sdpa:
        load_kw["attn_implementation"] = "sdpa"
    try:
        m = AutoModelForCausalLM.from_pretrained(MODEL_ID, **load_kw)
    except (TypeError, ValueError, OSError) as e:
        if "attn_implementation" in load_kw:
            log.warning("SDPA load failed (%s); retrying default attention.", e)
            m = AutoModelForCausalLM.from_pretrained(MODEL_ID, **kwargs)
        else:
            raise
    if not torch.cuda.is_available():
        m = m.to("cpu")
    m.eval()
    _tokenizer = tok
    _model = m
    _loaded_id = MODEL_ID
    log.info("Model ready on %s", next(_model.parameters()).device)


app = FastAPI(title="Appli.io PyTorch chat", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup():
    load_model()


def _check_auth(request: Request):
    if not API_KEY:
        return
    auth = request.headers.get("authorization") or ""
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization")
    if auth[7:].strip() != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatCompletionBody(BaseModel):
    model: str = ""
    messages: list[ChatMessage]
    temperature: float = 0.7
    max_tokens: int = Field(default=2048, ge=1, le=8192)
    stream: bool = False
    response_format: dict | None = None


def _messages_to_hf(messages: list[ChatMessage], json_mode: bool) -> list[dict]:
    out = [{"role": m.role, "content": m.content} for m in messages]
    if json_mode:
        hint = "You must respond with a single valid JSON object only, no markdown or extra text."
        if out and out[0]["role"] == "system":
            out[0] = {
                "role": "system",
                "content": out[0]["content"].strip() + "\n\n" + hint,
            }
        else:
            out.insert(0, {"role": "system", "content": hint})
    return out


def _generate_blocking(body: ChatCompletionBody) -> str:
    global _tokenizer, _model
    assert _tokenizer is not None and _model is not None

    json_mode = bool(
        body.response_format
        and isinstance(body.response_format, dict)
        and body.response_format.get("type") == "json_object"
    )
    hf_messages = _messages_to_hf(body.messages, json_mode)

    if not hasattr(_tokenizer, "apply_chat_template"):
        raise ValueError("Tokenizer has no chat_template; use an Instruct/chat model.")

    try:
        prompt = _tokenizer.apply_chat_template(
            hf_messages,
            tokenize=False,
            add_generation_prompt=True,
        )
    except Exception as e:
        raise ValueError(f"Chat template error: {e}") from e

    raw = _tokenizer(prompt, return_tensors="pt")
    max_in = int(os.environ.get("APPLI_PYTORCH_MAX_INPUT_TOKENS", "8192"))
    input_ids = raw["input_ids"]
    attn = raw.get("attention_mask")
    if input_ids.shape[1] > max_in:
        log.warning("Truncating prompt from %s to %s tokens", input_ids.shape[1], max_in)
        input_ids = input_ids[:, -max_in:]
        if attn is not None:
            attn = attn[:, -max_in:]
    inputs = {"input_ids": input_ids.to(_model.device)}
    if attn is not None:
        inputs["attention_mask"] = attn.to(_model.device)

    in_len = inputs["input_ids"].shape[1]
    max_pos = int(getattr(_model.config, "max_position_embeddings", 32768) or 32768)
    room = max_pos - in_len - 8
    if room < 32:
        raise ValueError(
            f"Prompt too long ({in_len} tokens, max context ~{max_pos}). Shorten the resume or raise APPLI_PYTORCH_MAX_INPUT_TOKENS."
        )
    max_new = min(int(body.max_tokens), 8192, room)

    gen_kwargs = {
        "max_new_tokens": max_new,
        "pad_token_id": _tokenizer.eos_token_id,
    }
    if body.temperature <= 0:
        gen_kwargs["do_sample"] = False
    else:
        gen_kwargs["do_sample"] = True
        gen_kwargs["temperature"] = min(max(body.temperature, 0.01), 2.0)

    with _model_lock:
        with torch.inference_mode():
            try:
                out = _model.generate(**inputs, **gen_kwargs)
            except RuntimeError as e:
                msg = str(e).lower()
                if "out of memory" in msg or "mps backend" in msg:
                    log.error("Generation OOM: %s", e)
                    raise RuntimeError(
                        "Model ran out of memory — try a shorter resume, lower max_tokens in the client, or use GPU."
                    ) from e
                raise

    # Strip prompt tokens
    in_len = inputs["input_ids"].shape[1]
    new_tokens = out[0, in_len:]
    text = _tokenizer.decode(new_tokens, skip_special_tokens=True).strip()
    if not text:
        raise RuntimeError("Model returned empty text")
    return text


@app.get("/health")
def health():
    return {"status": "ok", "backend": "pytorch", "model": MODEL_ID}


@app.get("/v1/models")
def list_models(request: Request):
    _check_auth(request)
    now = int(time.time())
    return {
        "object": "list",
        "data": [
            {
                "id": MODEL_ID,
                "object": "model",
                "created": now,
                "owned_by": "appli-pytorch",
            }
        ],
    }


@app.post("/v1/chat/completions")
async def chat_completions(request: Request, body: ChatCompletionBody):
    _check_auth(request)
    if body.stream:
        raise HTTPException(status_code=501, detail="stream=true not supported")
    # Accept any model name if server is single-model; still run.
    try:
        content = await run_in_threadpool(_generate_blocking, body)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    except Exception as e:
        log.exception("Generation failed")
        raise HTTPException(status_code=502, detail=str(e)) from e

    return {
        "id": f"chatcmpl-{uuid.uuid4().hex[:24]}",
        "object": "chat.completion",
        "created": int(time.time()),
        "model": body.model or MODEL_ID,
        "choices": [
            {
                "index": 0,
                "message": {"role": "assistant", "content": content},
                "finish_reason": "stop",
            }
        ],
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=HOST, port=PORT, log_level="info")
