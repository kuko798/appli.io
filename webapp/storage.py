"""JSON file persistence per signed-in Gmail address."""
from __future__ import annotations

import json
import re
import threading
import time
from pathlib import Path
from typing import Any

_lock = threading.Lock()
DATA_DIR = Path(__file__).resolve().parent / "data"
PROCESSED_TTL_SEC = 120 * 24 * 3600
PROCESSED_MAX = 6000


def _safe_user_key(email: str) -> str:
    e = (email or "unknown").lower().strip()
    e = re.sub(r"[^a-z0-9._+-]+", "_", e)[:120]
    return e or "unknown"


def _user_dir(email: str) -> Path:
    d = DATA_DIR / _safe_user_key(email)
    d.mkdir(parents=True, exist_ok=True)
    return d


def load_jobs(email: str) -> list[dict[str, Any]]:
    p = _user_dir(email) / "jobs.json"
    if not p.exists():
        return []
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return []


def save_jobs(email: str, jobs: list[dict[str, Any]]) -> None:
    p = _user_dir(email) / "jobs.json"
    tmp = p.with_suffix(".tmp")
    tmp.write_text(json.dumps(jobs, indent=2), encoding="utf-8")
    tmp.replace(p)


def load_profile(email: str) -> dict[str, Any]:
    """Server-side user profile (same Google account from any browser)."""
    p = _user_dir(email) / "profile.json"
    if not p.exists():
        return {}
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def save_profile(email: str, profile: dict[str, Any]) -> None:
    p = _user_dir(email) / "profile.json"
    tmp = p.with_suffix(".tmp")
    tmp.write_text(json.dumps(profile, indent=2), encoding="utf-8")
    tmp.replace(p)


STATUS_PRIORITY = {"Applied": 1, "Interview": 2, "Rejected": 3, "Offer": 4}


def _norm_text(v: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9\s]", " ", (v or "").lower())).strip()


def _same_company(a: str | None, b: str | None) -> bool:
    if not a or not b:
        return False
    left = re.sub(
        r"\b(inc|llc|ltd|corp|corporation|company|co)\b", "", _norm_text(a)
    ).strip()
    right = re.sub(
        r"\b(inc|llc|ltd|corp|corporation|company|co)\b", "", _norm_text(b)
    ).strip()
    if not left or not right:
        return False
    return left == right or left in right or right in left


def merge_job(email: str, new_job: dict[str, Any]) -> None:
    with _lock:
        jobs = load_jobs(email)
        nid = new_job.get("id")
        pri = STATUS_PRIORITY.get(new_job.get("status") or "", 0)

        for i, j in enumerate(jobs):
            if j.get("id") == nid:
                old_p = STATUS_PRIORITY.get(j.get("status") or "", 0)
                if pri > old_p:
                    jobs[i] = {**j, **new_job}
                    save_jobs(email, jobs)
                return

        for i, j in enumerate(jobs):
            if _same_company(j.get("company"), new_job.get("company")):
                try:
                    gap = abs(
                        _parse_date(j.get("date"))
                        - _parse_date(new_job.get("date"))
                    )
                except Exception:
                    gap = 999
                if gap < 120 * 24 * 3600:
                    old_p = STATUS_PRIORITY.get(j.get("status") or "", 0)
                    if pri > old_p:
                        jobs[i] = {
                            **j,
                            "status": new_job.get("status"),
                            "lastUpdated": new_job.get("lastUpdated"),
                        }
                        save_jobs(email, jobs)
                    return

        jobs.append(new_job)
        save_jobs(email, jobs)


def _parse_date(s: Any) -> float:
    if s is None:
        return 0.0
    from email.utils import parsedate_to_datetime

    try:
        return parsedate_to_datetime(str(s)).timestamp()
    except Exception:
        try:
            return time.mktime(time.strptime(str(s)[:10], "%Y-%m-%d"))
        except Exception:
            return 0.0


def load_processed(email: str) -> dict[str, Any]:
    p = _user_dir(email) / "processed.json"
    if not p.exists():
        return {}
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return {}


def save_processed(email: str, cache: dict[str, Any]) -> None:
    p = _user_dir(email) / "processed.json"
    now_ms = time.time() * 1000
    ttl_ms = PROCESSED_TTL_SEC * 1000
    items = [
        (k, v)
        for k, v in cache.items()
        if isinstance(v, dict) and isinstance(v.get("ts"), (int, float)) and now_ms - v["ts"] <= ttl_ms
    ]
    items.sort(key=lambda x: x[1].get("ts") or 0, reverse=True)
    items = items[:PROCESSED_MAX]
    p.write_text(json.dumps(dict(items), indent=2), encoding="utf-8")


def mark_processed(email: str, message_id: str, result: str) -> None:
    with _lock:
        c = load_processed(email)
        c[message_id] = {"ts": time.time() * 1000, "result": result}
        save_processed(email, c)


def was_processed(email: str, message_id: str) -> bool:
    return message_id in load_processed(email)


def try_update_status_without_role(
    email: str,
    message_id: str,
    subject: str,
    company: str | None,
    status: str | None,
    date_header: str,
) -> bool:
    if not status:
        return False
    with _lock:
        jobs = load_jobs(email)
        if not jobs:
            return False
        norm_sub = _norm_text(subject)
        target_ts = _parse_date(date_header)
        best_i = -1
        best_score = -1.0
        for i, job in enumerate(jobs):
            try:
                gap_days = abs(_parse_date(job.get("date")) - target_ts) / 86400
            except Exception:
                gap_days = 999
            if gap_days > 180:
                continue
            score = 0.0
            if _same_company(job.get("company"), company):
                score += 5
            js = _norm_text(job.get("subject") or "")
            if js and norm_sub:
                if js == norm_sub:
                    score += 6
                elif norm_sub in js or js in norm_sub:
                    score += 4
            if gap_days <= 30:
                score += 3
            elif gap_days <= 90:
                score += 1
            if score > best_score:
                best_score = score
                best_i = i
        if best_i < 0 or best_score < 4:
            return False
        old = jobs[best_i]
        if STATUS_PRIORITY.get(status, 0) <= STATUS_PRIORITY.get(old.get("status") or "", 0):
            return False
        jobs[best_i] = {
            **old,
            "id": old.get("id") or message_id,
            "status": status,
            "lastUpdated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
        save_jobs(email, jobs)
        return True
