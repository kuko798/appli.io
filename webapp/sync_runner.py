"""Gmail list + classify pipeline (extension parity)."""
from __future__ import annotations

import time
from datetime import datetime, timedelta, timezone
from typing import Any

from classify_engine import classify_email
from gmail_filters import is_promotional, should_analyze_email
from gmail_mime import extract_body_from_payload, header
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

import storage

GMAIL_QUERY_TEMPLATE = (
    '(subject:(application OR interview OR offer OR rejection OR "thank you for applying" '
    'OR "your application" OR "thank you for your interest") '
    'OR ("move forward" OR "next steps" OR "phone screen" OR "we regret")) after:{after}'
)


def _after_date(range_key: str) -> str:
    d = datetime.now(timezone.utc)
    if range_key == "3m":
        d = d - timedelta(days=93)
    elif range_key == "6m":
        d = d - timedelta(days=186)
    elif range_key == "1y":
        d = d - timedelta(days=365)
    else:
        d = d - timedelta(days=31)
    return f"{d.year}/{d.month:02d}/{d.day:02d}"


def run_sync(user_email: str, creds: Credentials, range_key: str = "1m") -> dict[str, Any]:
    after = _after_date(range_key)
    q = GMAIL_QUERY_TEMPLATE.format(after=after)
    service = build("gmail", "v1", credentials=creds, cache_discovery=False)

    stats = {
        "scanned": 0,
        "saved": 0,
        "skipped_promo": 0,
        "skipped_filter": 0,
        "skipped_non_application": 0,
        "skipped_no_role": 0,
        "skipped_already": 0,
        "updated_status": 0,
        "errors": 0,
    }

    page_token = None
    while True:
        req = (
            service.users()
            .messages()
            .list(userId="me", q=q, maxResults=100, pageToken=page_token)
        )
        res = req.execute()
        messages = res.get("messages") or []
        for m in messages:
            mid = m["id"]
            stats["scanned"] += 1
            try:
                _process_one(service, user_email, mid, stats)
            except Exception:
                stats["errors"] += 1
        page_token = res.get("nextPageToken")
        if not page_token:
            break

    return {"ok": True, "after": after, "query": q, "stats": stats}


def _process_one(service, user_email: str, message_id: str, stats: dict[str, Any]) -> None:
    if storage.was_processed(user_email, message_id):
        stats["skipped_already"] += 1
        return

    msg = (
        service.users()
        .messages()
        .get(userId="me", id=message_id, format="full")
        .execute()
    )
    pl = msg.get("payload") or {}
    headers = pl.get("headers") or []
    subject = header(headers, "Subject")
    from_addr = header(headers, "From")
    date_h = header(headers, "Date")
    snippet = msg.get("snippet") or ""
    full_body = extract_body_from_payload(pl) or snippet

    if is_promotional(subject, full_body, from_addr):
        stats["skipped_promo"] += 1
        storage.mark_processed(user_email, message_id, "promotional")
        return
    if not should_analyze_email(subject, full_body, from_addr):
        stats["skipped_filter"] += 1
        storage.mark_processed(user_email, message_id, "not-job-related")
        return

    analysis = classify_email(subject, full_body)
    st = analysis.get("status")
    if st is None:
        stats["skipped_non_application"] += 1
        storage.mark_processed(user_email, message_id, "non-application")
        return

    role = analysis.get("role")
    company = analysis.get("company")
    if not role:
        if storage.try_update_status_without_role(
            user_email, message_id, subject, company, st, date_h
        ):
            stats["updated_status"] += 1
            storage.mark_processed(user_email, message_id, "status-updated")
        else:
            stats["skipped_no_role"] += 1
            storage.mark_processed(user_email, message_id, "no-role")
        return

    job = {
        "id": message_id,
        "company": company,
        "title": role,
        "subject": subject,
        "status": st,
        "date": date_h,
        "lastUpdated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "aiConfidence": analysis.get("confidence"),
        "aiSignals": analysis.get("signals") or [],
        "aiNextAction": analysis.get("nextAction"),
        "aiSummary": analysis.get("summary"),
        "aiReason": analysis.get("reason"),
    }
    storage.merge_job(user_email, job)
    stats["saved"] += 1
    storage.mark_processed(user_email, message_id, "saved")
