"""
Appli.io web app — Gmail OAuth + Python classification (rules + optional Ollama).

Setup (Google Cloud Console → APIs → OAuth consent + Credentials → Web application):
  Authorized redirect URI: http://127.0.0.1:8766/auth/callback (match APPLI_PUBLIC_URL)

Environment:
  GOOGLE_CLIENT_ID       required
  GOOGLE_CLIENT_SECRET   required
  SESSION_SECRET         required for production (random string)
  APPLI_PUBLIC_URL       default http://127.0.0.1:8766
  GOOGLE_REDIRECT_URI    optional override (must match Console exactly)
  APPLI_OLLAMA_MODEL     optional, e.g. llama3.2 — local Ollama for smarter labels
  APPLI_OLLAMA_HOST      default http://127.0.0.1:11434

Run:
  cd webapp && pip install -r requirements.txt
  set GOOGLE_CLIENT_ID=... && set GOOGLE_CLIENT_SECRET=... && set SESSION_SECRET=...
  python main.py
"""
from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, RedirectResponse
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from starlette.middleware.sessions import SessionMiddleware

import storage
from sync_runner import run_sync

BASE = Path(__file__).resolve().parent
SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "").strip()
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "").strip()
PUBLIC_URL = os.environ.get("APPLI_PUBLIC_URL", "http://127.0.0.1:8766").rstrip("/")
REDIRECT_URI = os.environ.get("GOOGLE_REDIRECT_URI", f"{PUBLIC_URL}/auth/callback")
SESSION_SECRET = os.environ.get("SESSION_SECRET", "dev-insecure-change-me")

app = FastAPI(title="Appli.io Web")
app.add_middleware(SessionMiddleware, secret_key=SESSION_SECRET, same_site="lax")


def _client_config() -> dict:
    return {
        "web": {
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [REDIRECT_URI],
        }
    }


def _new_flow() -> Flow:
    return Flow.from_client_config(_client_config(), scopes=SCOPES, redirect_uri=REDIRECT_URI)


def _creds_from_session(sess: dict) -> Credentials:
    return Credentials(
        token=sess.get("token"),
        refresh_token=sess.get("refresh_token"),
        token_uri="https://oauth2.googleapis.com/token",
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET,
        scopes=SCOPES,
    )


def _ensure_oauth_config() -> None:
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(
            503,
            "Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET environment variables.",
        )


def get_credentials(request: Request) -> Credentials:
    _ensure_oauth_config()
    if not request.session.get("token"):
        raise HTTPException(401, "Sign in with Google first.")
    c = _creds_from_session(dict(request.session))
    if c.expired and c.refresh_token:
        c.refresh(GoogleAuthRequest())
        request.session["token"] = c.token
    return c


def ensure_user_email(request: Request, creds: Credentials) -> str:
    em = request.session.get("user_email")
    if em:
        return em
    service = build("gmail", "v1", credentials=creds, cache_discovery=False)
    prof = service.users().getProfile(userId="me").execute()
    em = prof.get("emailAddress") or "unknown"
    request.session["user_email"] = em
    return em


@app.get("/")
def index():
    return FileResponse(BASE / "static" / "index.html")


@app.get("/api/health")
def health():
    return {
        "ok": True,
        "oauth_configured": bool(GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET),
        "ollama_model": os.environ.get("APPLI_OLLAMA_MODEL", "") or None,
    }


@app.get("/api/me")
def api_me(request: Request):
    if not request.session.get("token"):
        return {"signed_in": False, "email": None}
    try:
        creds = get_credentials(request)
        email = ensure_user_email(request, creds)
        return {"signed_in": True, "email": email}
    except HTTPException:
        return {"signed_in": False, "email": None}


@app.get("/auth/google")
def auth_google(request: Request):
    _ensure_oauth_config()
    flow = _new_flow()
    auth_url, state = flow.authorization_url(
        access_type="offline",
        prompt="consent",
        include_granted_scopes="true",
    )
    request.session["oauth_state"] = state
    return RedirectResponse(auth_url)


@app.get("/auth/callback")
def auth_callback(request: Request, code: str | None = None, state: str | None = None):
    _ensure_oauth_config()
    if state != request.session.get("oauth_state"):
        raise HTTPException(400, "Invalid OAuth state")
    if not code:
        raise HTTPException(400, "Missing authorization code")

    flow = _new_flow()
    flow.fetch_token(code=code)
    creds = flow.credentials
    request.session["token"] = creds.token
    request.session["refresh_token"] = creds.refresh_token
    request.session["oauth_state"] = None

    cr = _creds_from_session(dict(request.session))
    service = build("gmail", "v1", credentials=cr, cache_discovery=False)
    prof = service.users().getProfile(userId="me").execute()
    request.session["user_email"] = prof.get("emailAddress", "unknown")
    return RedirectResponse("/")


@app.post("/api/logout")
def logout(request: Request):
    request.session.clear()
    return {"ok": True}


@app.get("/api/jobs")
def api_jobs(request: Request):
    creds = get_credentials(request)
    email = ensure_user_email(request, creds)
    return {"jobs": storage.load_jobs(email)}


@app.post("/api/sync")
async def api_sync(request: Request):
    try:
        raw = await request.json()
    except Exception:
        raw = {}
    range_key = raw.get("range", "1m") if isinstance(raw, dict) else "1m"
    if range_key not in ("1m", "3m", "6m", "1y"):
        range_key = "1m"
    creds = get_credentials(request)
    email = ensure_user_email(request, creds)
    return run_sync(email, creds, range_key)


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", "8766"))
    uvicorn.run("main:app", host="127.0.0.1", port=port, reload=False)
