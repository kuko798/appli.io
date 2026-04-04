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
  APPLI_WEBAPP_HOST      bind address (default 127.0.0.1; use 0.0.0.0 in Docker)
  APPLI_CORS_ORIGINS     comma-separated origins for Bearer JSON APIs (jobs + profile), e.g. https://app.pages.dev
  APPLI_OLLAMA_MODEL     optional, e.g. llama3.2 — local Ollama for smarter labels
  APPLI_OLLAMA_HOST      default http://127.0.0.1:11434

Run:
  cd webapp && pip install -r requirements.txt
  set GOOGLE_CLIENT_ID=... && set GOOGLE_CLIENT_SECRET=... && set SESSION_SECRET=...
  python main.py
"""
from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
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
_goog_redir = os.environ.get("GOOGLE_REDIRECT_URI", "").strip()
REDIRECT_URI = (_goog_redir if _goog_redir else f"{PUBLIC_URL}/auth/callback").rstrip("/")
SESSION_SECRET = os.environ.get("SESSION_SECRET", "dev-insecure-change-me")

app = FastAPI(title="Appli.io Web")
app.add_middleware(SessionMiddleware, secret_key=SESSION_SECRET, same_site="lax")

_cors_origins = os.environ.get("APPLI_CORS_ORIGINS", "").strip()
if _cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[o.strip() for o in _cors_origins.split(",") if o.strip()],
        allow_credentials=False,
        allow_methods=["GET", "PUT", "POST", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )


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


def _userinfo_from_access_token(authorization: str | None) -> dict[str, Any]:
    """Verify GIS access token and return normalized Google userinfo fields."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Missing or invalid Authorization header")
    token = authorization[7:].strip()
    if not token:
        raise HTTPException(401, "Empty Bearer token")
    try:
        req = urllib.request.Request(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {token}"},
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            payload = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        raise HTTPException(401, f"Token rejected ({e.code})") from e
    except Exception as exc:
        raise HTTPException(401, "Could not verify access token") from exc
    if not isinstance(payload, dict):
        raise HTTPException(401, "Invalid userinfo response")
    email = (payload.get("email") or "").strip()
    if not email:
        raise HTTPException(
            401,
            "Access token has no email — add userinfo.email scope in Google Identity Services.",
        )
    return {
        "email": email,
        "email_verified": bool(payload.get("email_verified")),
        "name": (payload.get("name") or "").strip(),
        "picture": (payload.get("picture") or "").strip(),
        "sub": (payload.get("sub") or "").strip(),
    }


def _email_from_access_token(authorization: str | None) -> str:
    """Resolve Gmail user email from a GIS access token (mobile / static dashboard)."""
    info = _userinfo_from_access_token(authorization)
    return info["email"]


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


@app.get("/api/jobs/bearer")
def api_jobs_bearer(authorization: str | None = Header(None)):
    """Same as /api/jobs but for the static dashboard (Bearer = GIS access token)."""
    email = _email_from_access_token(authorization)
    return {"jobs": storage.load_jobs(email)}


@app.put("/api/jobs/bearer")
async def api_jobs_bearer_put(request: Request, authorization: str | None = Header(None)):
    email = _email_from_access_token(authorization)
    try:
        raw = await request.json()
    except Exception:
        raise HTTPException(400, "Invalid JSON body") from None
    jobs = raw.get("jobs") if isinstance(raw, dict) else None
    if not isinstance(jobs, list):
        raise HTTPException(400, 'Body must be JSON object with "jobs" array')
    storage.save_jobs(email, jobs)
    return {"ok": True}


@app.get("/api/profile/bearer")
def api_profile_bearer(authorization: str | None = Header(None)):
    """
    Canonical user profile for the static dashboard: verify token, merge with stored record, persist.
    Same Google account gets the same profile from Chrome, Edge, phone, etc. when VITE_JOBS_API_BASE points here.
    """
    fresh = _userinfo_from_access_token(authorization)
    email = fresh["email"]
    stored = storage.load_profile(email)
    merged: dict[str, Any] = {
        **stored,
        "email": email,
        "google_sub": fresh["sub"] or stored.get("google_sub") or "",
        "name": fresh["name"] or stored.get("name") or "",
        "picture": fresh["picture"] or stored.get("picture") or "",
        "email_verified": fresh["email_verified"],
        "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    storage.save_profile(email, merged)
    return {
        "email": merged["email"],
        "name": merged.get("name") or "",
        "picture": merged.get("picture") or "",
        "sub": merged.get("google_sub") or "",
        "updated_at": merged.get("updated_at"),
    }


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
    host = os.environ.get("APPLI_WEBAPP_HOST", "127.0.0.1").strip() or "127.0.0.1"
    uvicorn.run("main:app", host=host, port=port, reload=False)
