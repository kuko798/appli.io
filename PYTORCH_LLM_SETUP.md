# Local LLM with PyTorch (Transformers)

Appli.io’s extension calls an **OpenAI-compatible** `POST /v1/chat/completions` endpoint for interview simulator, company intel, resume JSON tools, etc. This repo includes **`pytorch_chat_server`**, which serves that API using **Hugging Face Transformers + PyTorch** (no vLLM).

## 1) Install

```bash
cd pytorch_chat_server
pip install -r requirements.txt
```

Use a CUDA-enabled `torch` build if you have a GPU ([pytorch.org](https://pytorch.org)).

## 2) Run (default port 8000)

```bash
cd pytorch_chat_server
python server.py
```

Optional environment:

| Variable | Meaning |
|----------|---------|
| `APPLI_PYTORCH_MODEL` | Hugging Face model id (default `Qwen/Qwen2.5-1.5B-Instruct`) |
| `APPLI_PYTORCH_PORT` | Port (default `8000`) |
| `APPLI_PYTORCH_HOST` | Bind address (default `0.0.0.0`) |
| `APPLI_PYTORCH_API_KEY` | If set, clients must send `Authorization: Bearer …` |
| `HF_TOKEN` | For gated models |

## 3) Extension options

- **Base URL:** `http://localhost:8000` for the packaged extension. **Vite dev dashboard** (port 5173) defaults to the proxy `http://localhost:5173/appli-llm` → same server on port 8000.
- **Model name:** exactly the same string as `APPLI_PYTORCH_MODEL` (default `Qwen/Qwen2.5-1.5B-Instruct`)
- **API key:** blank unless you set `APPLI_PYTORCH_API_KEY`

Gmail classification still uses **`python_classifier/service.py`** on port **8765** separately.

## 4) Notes

- First run downloads weights from Hugging Face.
- CPU works for the default 1.5B model; larger models need more RAM/VRAM.
- `stream=true` is not implemented (the app uses non-streaming calls).
