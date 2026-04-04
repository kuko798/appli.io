"""Pre-filters aligned with src/services/gmailService.js."""
from __future__ import annotations

import re

def is_promotional(subject: str, body: str, from_addr: str) -> bool:
    s = (subject or "").lower()
    b = (body or "").lower()
    f = (from_addr or "").lower()
    bad_subjects = [
        "newsletter",
        "job recommendations",
        "digest",
        "webinar",
        "matches for you",
        "ask a recruiter",
        "office hours",
        "listen now",
        "new jobs for you",
        "jobs you may like",
        "recommended jobs",
        "jobs near you",
        "weekly jobs",
        "job alert",
        "career digest",
    ]
    bad_body = [
        "ask a recruiter",
        "tips from",
        "interview tips",
        "ace the interview",
        "ace interviews",
        "think on your feet",
        "listen now",
        "podcast",
        "communication expert",
        "watch now",
        "register now",
        "jobs based on your profile",
        "similar jobs",
        "unsubscribe from job alerts",
    ]
    bad_senders = [
        "noreply@glassdoor.com",
        "notifications@linkedin.com",
        "jobalerts@",
        "alerts@indeed.com",
        "newsletter@",
        "marketing@indeed.com",
        "jobs-noreply@linkedin.com",
    ]
    return any(x in s for x in bad_subjects) or any(x in b for x in bad_body) or any(x in f for x in bad_senders)


def is_likely_job_board_blast(subject: str, body: str, from_addr: str) -> bool:
    s = (subject or "").lower()
    b = (body or "").lower()[:800]
    f = (from_addr or "").lower()
    if re.search(r"\b\d+\+?\s*(new )?jobs\b", s, re.I) and re.search(r"job|career|role", s, re.I):
        return True
    if re.search(r"\bjobs (for|matching|recommended|picked|near) you\b", s, re.I):
        return True
    if re.search(r"\b(weekly|daily) (job )?(digest|roundup)\b", s, re.I):
        return True
    if "view all jobs" in b and "apply" in b:
        return True
    if re.search(r"@(?:indeed|ziprecruiter|monster)\.", f, re.I) and re.search(
        r"job alert|new jobs", s + b, re.I
    ):
        return True
    return False


def should_analyze_email(subject: str, body: str, from_addr: str) -> bool:
    text = f"{subject or ''}\n{body or ''}\n{from_addr or ''}"
    lower = text.lower()
    if is_likely_job_board_blast(subject, body, from_addr):
        return False
    strong = [
        re.compile(r"thank you for (your )?applying", re.I),
        re.compile(r"thank you for your application", re.I),
        re.compile(r"application (has been )?received", re.I),
        re.compile(r"received your application", re.I),
        re.compile(r"we (have )?received your application", re.I),
        re.compile(r"regret to (inform|advise)", re.I),
        re.compile(r"not (be )?moving forward", re.I),
        re.compile(r"not selected", re.I),
        re.compile(r"phone screen", re.I),
        re.compile(r"schedule (a |an )?(call|interview|time)", re.I),
        re.compile(r"invite you to", re.I),
        re.compile(r"\bjob offer\b", re.I),
        re.compile(r"offer letter", re.I),
        re.compile(r"pleased to (extend|offer)", re.I),
        re.compile(r"would like to (extend|offer)", re.I),
        re.compile(r"other candidate|other candidates|another candidate", re.I),
        re.compile(r"status of your application", re.I),
        re.compile(r"update on your application", re.I),
        re.compile(r"your application for\b", re.I),
        re.compile(r"your candidacy", re.I),
        re.compile(r"next steps.{0,40}(interview|call|schedule)", re.I | re.S),
    ]
    if any(p.search(text) for p in strong):
        return True
    soft = [
        "hiring manager",
        "talent acquisition",
        "recruiting team",
        "your interview",
        "application for the",
        "role you applied",
        "position you applied",
    ]
    return sum(1 for phrase in soft if phrase in lower) >= 2
