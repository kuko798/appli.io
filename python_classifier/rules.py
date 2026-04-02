"""
High-precision rule engine for recruiting email labels (ported from extension classifier.js).
"""
from __future__ import annotations

import re
from typing import Any

STRONG_REJECTION_PATTERNS = [
    re.compile(r"not (be )?moving forward", re.I),
    re.compile(r"decided not to move forward", re.I),
    re.compile(r"will not be moving forward", re.I),
    re.compile(r"unable to offer", re.I),
    re.compile(r"not selected", re.I),
    re.compile(r"decided to pursue other candidates", re.I),
    re.compile(r"pursuing other candidates", re.I),
    re.compile(r"offered? (the )?(position|role) to (another|other) candidate", re.I),
    re.compile(r"extended an offer to (another|other) candidate", re.I),
    re.compile(r"position has been filled", re.I),
    re.compile(r"filled (the )?(position|role)", re.I),
    re.compile(r"no longer considering", re.I),
    re.compile(r"not the right fit", re.I),
    re.compile(r"going (in )?a different direction", re.I),
    re.compile(r"more qualified candidates", re.I),
    re.compile(r"regret(s|ted)? to (inform|advise|let you know)", re.I),
    re.compile(r"whose qualifications better align", re.I),
    re.compile(r"better align(ed|s|ing)? with (our )?(requirements|needs|qualifications)", re.I),
    re.compile(r"unable to proceed (further )?with your application", re.I),
    re.compile(r"we (are )?unable to (move forward|proceed) with your application", re.I),
    re.compile(
        r"after careful (review|consideration).{0,260}?"
        r"(not (be )?moving forward|other candidates?|regret|unable to offer|not selected|decided not|"
        r"will not be moving|chosen (another|a different|other)|move forward with other)",
        re.I | re.S,
    ),
    re.compile(
        r"unfortunately.{0,140}?"
        r"(not selected|not moving forward|unable to|regret|other candidate|will not be|decided not|pursue other)",
        re.I | re.S,
    ),
    re.compile(r"(won'?t|will not) be able to invite you to the next stage", re.I),
    re.compile(r"unable to invite you to the next stage", re.I),
    # "won't" ≠ "not ... moving forward" — Pinterest, AVEVA, etc.
    re.compile(r"won'?t be moving forward", re.I),
    re.compile(r"won'?t be able to move forward", re.I),
    re.compile(r"not able to move forward with your candidacy", re.I),
    # We are moving forward with someone else (HPE, Sierra, Salesforce, Airtable, Trane, …)
    re.compile(r"\bmove forward with (another|other) candidate", re.I),
    re.compile(r"\bmove forward with other candidates\b", re.I),
    re.compile(r"\bmade the decision to move forward with other candidates\b", re.I),
    re.compile(r"\bdecided to move forward with other candidates\b", re.I),
    re.compile(r"\bunable to offer you (this )?position\b", re.I),
    re.compile(r"\bnot been selected for further consideration\b", re.I),
    re.compile(r"\bdecided not to move forward with your application\b", re.I),
    re.compile(r"\bhave decided not to move forward\b", re.I),
    re.compile(r"\bwere not selected for this role\b", re.I),
    re.compile(r"\bpositions?\b.{0,80}?\bhave been filled\b", re.I | re.S),
    re.compile(r"\bhas decided not to move forward with your application\b", re.I),
    # GM-style: "decided to proceed with other candidates"
    re.compile(r"\bproceed with other candidates\b", re.I),
    re.compile(r"\bdecided to proceed with other candidates\b", re.I),
    re.compile(r"\bhave decided to proceed with other candidates\b", re.I),
]

_OFFER_OTHER = re.compile(
    r"offer.{0,40}(other|another) candidate|(other|another) candidate.{0,40}offer", re.I | re.S
)
_INTERVIEW = re.compile(
    r"schedule (a |an )?(time|call|interview|phone screen)|"
    r"availability for (a |an )?(call|interview)|"
    r"invite you to (a |an )?interview|"
    r"next steps? (is|are|would be) (to |)(a |an )?interview|"
    r"phone screen (with|for|w/)|"
    r"\brecruiter phone screen\b|"
    r"\bphone screen\b|"
    r"interview (invite|invitation|confirmation|scheduling)|"
    r"\bfellowship\b.{0,120}?\b(phone screen|interview|recruiter|schedule)\b|"
    r"\b(phone screen|interview).{0,80}?\bfellowship\b",
    re.I | re.S,
)
# Subject-only hints (threads often say "Recruiter Phone Screen" without body scheduling prose)
_INTERVIEW_SUBJECT = re.compile(
    r"recruiter phone screen|phone screen|fellowship.{0,60}(phone|interview|screen|recruiter)|"
    r"(phone screen|interview).{0,40}fellowship|"
    r"\bnext steps?\b.{0,40}\b(interview|call|phone)\b|"
    r"karat\s+interview|technical\s+screen",
    re.I | re.S,
)
# Take-home / platform assessments (CoderPad, HackerRank, etc.) — separate from live interview.
_ASSESSMENT = re.compile(
    r"\bcoderpad\b|"
    r"\bcoding challenge\b|"
    r"\bcode\s*signal\b|"
    r"\bcodility\b|"
    r"\bpair\s*programming\s+exercise\b|"
    r"\btechnical assessment\b|"
    r"\bonline assessment\b|"
    r"\bcomplete (the |your )?(online )?assessment\b|"
    r"\bassessment (link|platform|invite)\b|"
    r"\btimed\s+(coding|programming)\s+(challenge|exercise|test)\b|"
    r"\bhacker\s*rank\b.{0,100}?\b(assignment|assessment|challenge|test|exercise)\b|"
    r"\b(assignment|challenge|test|exercise).{0,100}?\bhacker\s*rank\b|"
    r"\btake[\s-]?home\b.{0,80}?\b(assignment|challenge|exercise|test)\b|"
    r"\bleetcode\b.{0,50}?\b(problem|question|challenge|assessment)\b|"
    r"\bthree questions that assess\b",
    re.I | re.S,
)
_ASSESSMENT_SUBJECT = re.compile(
    r"\bcoderpad\b|"
    r"\bcoding challenge\b|"
    r"\bcoder\s*pad\s+test\b|"
    r"\bcode\s*signal\b|"
    r"\btechnical assessment\b|"
    r"\bhacker\s*rank\b|"
    r"next steps with\b.+\b(coderpad|test|assessment|challenge)\b",
    re.I | re.S,
)
_OFFER_POS = re.compile(
    r"pleased to (extend|offer)|delighted to offer|happy to offer|would like to (extend|offer)|"
    r"formal (job )?offer|offer letter( attached)?|compensation package|base salary|starting salary",
    re.I,
)
_REJECT_NEAR = re.compile(
    r"not (be )?moving forward|unable to offer|won'?t be moving forward|"
    r"move forward with (another|other) candidate|move forward with other candidates|"
    r"proceed with other candidates",
    re.I,
)
_APPLIED = re.compile(
    r"received your application|thank you for (your )?applying|thanks?\s+for\s+applying|"
    r"application (has been )?received|we (have )?received your application|"
    r"thanks?\s+so much for submitting your application|"
    r"thank you for allowing us\b|"
    r"thank you for your interest in (?:the |our )|"
    r"thanks for exploring a future with us",
    re.I,
)

# Allow acronyms (AI, ML) between title words: "Chewy AI Innovator Fellowship"
_FELLOW_ROLE = re.compile(
    r"\b((?:[A-Z][a-z]+|[A-Z]{2,})(?:\s+(?:[A-Z][a-z]+|[A-Z]{2,})){0,5}\s+"
    r"(?:Fellowship|Internship|Apprenticeship|Residency))\b",
)
_ROLE_PATTERNS = [
    re.compile(
        r"\b(senior|junior|lead|staff|principal|associate)\s+"
        r"(software|frontend|backend|full[\s-]?stack|mobile|web|cloud|data|machine learning|ml|ai)\s+"
        r"(engineer|developer|architect)\b",
        re.I,
    ),
    re.compile(
        r"\b(software|frontend|backend|full[\s-]?stack|mobile|web|cloud|data|machine learning|ml|ai)\s+"
        r"(engineer|developer|architect)\b",
        re.I,
    ),
    re.compile(r"\b(product|project|program|engineering|technical)\s+(manager|director|lead)\b", re.I),
    re.compile(r"\b(data|business|financial|marketing|sales)\s+(analyst|scientist)\b", re.I),
    re.compile(r"\b(software engineer|data scientist|product manager)\b", re.I),
]


def has_strong_rejection(text: str) -> bool:
    if not text:
        return False
    return any(p.search(text) for p in STRONG_REJECTION_PATTERNS)


def is_offer_to_other(text: str) -> bool:
    return bool(_OFFER_OTHER.search(text or ""))


def has_strong_interview(text: str) -> bool:
    if not text:
        return False
    return bool(_INTERVIEW.search(text))


def has_interview_subject_hint(subject: str) -> bool:
    s = subject or ""
    return bool(_INTERVIEW_SUBJECT.search(s))


def has_assessment_signal(text: str, subject: str = "") -> bool:
    """Hiring-process coding tests / async assessments (not live interview scheduling)."""
    if not (text or "").strip():
        return False
    if has_strong_rejection(text) or is_offer_to_other(text):
        return False
    blob = f"{subject or ''} {text}"
    if _ASSESSMENT.search(blob):
        return True
    return bool(_ASSESSMENT_SUBJECT.search(subject or ""))


def has_strong_offer(text: str) -> bool:
    if not text:
        return False
    if has_strong_rejection(text) or is_offer_to_other(text):
        return False
    if _REJECT_NEAR.search(text):
        return False
    return bool(_OFFER_POS.search(text))


def has_applied_receipt(text: str) -> bool:
    if not text:
        return False
    if has_strong_rejection(text):
        return False
    return bool(_APPLIED.search(text))


def _normalize_recruiting_text(s: str) -> str:
    """Straighten quotes/apostrophes so patterns match Gmail/ATS Unicode."""
    if not s:
        return ""
    return (
        s.replace("\u2019", "'")
        .replace("\u2018", "'")
        .replace("\u201c", '"')
        .replace("\u201d", '"')
        .replace("\u00a0", " ")
    )


def predict_status(text: str, subject: str = "") -> str | None:
    if not (text or "").strip():
        return None
    t = _normalize_recruiting_text(str(text))
    subj = _normalize_recruiting_text(subject or "")
    if has_strong_rejection(t) or is_offer_to_other(t):
        return "Rejected"
    if has_strong_offer(t):
        return "Offer"
    if has_assessment_signal(t, subj):
        return "Assessment"
    if has_strong_interview(t) or has_interview_subject_hint(subj):
        return "Interview"
    if has_applied_receipt(t):
        return "Applied"
    return None


def extract_role(subject: str, body: str) -> str | None:
    subj_raw = _normalize_recruiting_text(subject or "")
    body_n = _normalize_recruiting_text(body or "")
    m = _FELLOW_ROLE.search(subj_raw)
    if m:
        return _smart_title_role(m.group(1).strip())
    m = re.search(
        r"\byour application for\s+(.+?)\s+at\s+[A-Z]",
        subj_raw,
        re.I,
    )
    if m:
        chunk = re.sub(r"\s+", " ", m.group(1).strip()).strip(" ,.;")
        if 4 <= len(chunk) <= 120:
            return _smart_title_role(chunk)
    raw_combo = f"{subj_raw} {body_n}"
    # GM: "Thank you for applying to the Software Engineer - Early Career position at General Motors"
    m = re.search(
        r"\b(?:thank you for )?applying to (?:the|our)\s+(.+?)\s+position at\b",
        raw_combo,
        re.I,
    )
    if m:
        chunk = re.sub(r"\s+", " ", m.group(1).strip()).strip(" ,.;:!?")
        if 4 <= len(chunk) <= 120:
            return _smart_title_role(chunk)
    # Sierra: "interest in the APX (New Grad) role at Sierra"
    m = re.search(
        r"\binterest in the\s+([A-Z0-9][A-Za-z0-9(),\s-]{2,85}?)\s+role at\b",
        raw_combo,
        re.I,
    )
    if m:
        chunk = re.sub(r"\s+", " ", m.group(1).strip()).strip(" ,.;")
        if 2 <= len(chunk) <= 100:
            return _smart_title_role(chunk)
    # Morgridge: "interest in our open Student Web Developer position"
    m = re.search(
        r"\bour open\s+([A-Za-z0-9][A-Za-z0-9\s/&'-]{2,75}?)\s+position\b",
        raw_combo,
        re.I,
    )
    if m:
        chunk = re.sub(r"\s+", " ", m.group(1).strip()).strip(" ,.;")
        if 3 <= len(chunk) <= 100:
            return _smart_title_role(chunk)
    # Maven: "Thank you for applying to our Graduate Developer Programme Chicago 2026."
    m = re.search(
        r"\bthank you for applying to our\s+([^.!?\n]{6,120}?)(?:[.!?\n]|$)",
        raw_combo,
        re.I,
    )
    if m:
        chunk = re.sub(r"\s+", " ", m.group(1).strip()).strip(" ,.;:!?")
        if 6 <= len(chunk) <= 120:
            return _smart_title_role(chunk)
    m = re.search(
        r"\bfor the\s+([A-Z][A-Za-z0-9\s,\[\]().+:/&'-]{3,90}?)\s+role\b",
        raw_combo,
        re.I,
    )
    if m:
        chunk = re.sub(r"\s+", " ", m.group(1).strip())
        chunk = re.sub(r"^\[[^\]]+\]\s*", "", chunk)
        if 4 <= len(chunk) <= 100:
            return _smart_title_role(chunk)
    m = re.search(
        r"\bapplying to\s+([^(\n]{4,95}?)\s*\(",
        raw_combo,
        re.I,
    )
    if m:
        chunk = re.sub(r"\s+", " ", m.group(1).strip()).strip(" ,.;")
        if 4 <= len(chunk) <= 100:
            return _smart_title_role(chunk)
    blob = f"{subj_raw} {body_n}".lower()
    for pat in _ROLE_PATTERNS:
        m2 = pat.search(blob)
        if m2:
            return _title_case(m2.group(0).strip())
    return None


_ATS_EMAIL_DOMAINS = frozenset(
    {
        "myworkday.com",
        "greenhouse.io",
        "lever.co",
        "ashbyhq.com",
        "smartrecruiters.com",
        "icims.com",
        "taleo.net",
        "ultipro.com",
        "bamboohr.com",
    }
)
_CONSUMER_DOMAINS = frozenset(
    {
        "gmail.com",
        "googlemail.com",
        "yahoo.com",
        "hotmail.com",
        "outlook.com",
        "live.com",
        "icloud.com",
        "proton.me",
        "protonmail.com",
        "pm.me",
        "mail.com",
    }
)
# Domains that send mail for many employers — never use SLD as company name.
_RECRUITING_VENDOR_DOMAIN_SUFFIXES = (
    "greenhouse.io",
    "lever.co",
    "myworkday.com",
    "ashbyhq.com",
    "mindbodyonline.com",
    "joinhandshake.com",
    "smartrecruiters.com",
    "icims.com",
    "taleo.net",
    "bamboohr.com",
    "indeed.com",
    "linkedin.com",
    "workable.com",
    "recruitee.com",
    "teamtailor.com",
    "oraclecloud.com",
    "ultipro.com",
    "jobvite.com",
    "comeet.co",
    "rippling.com",
    "jazzhr.com",
    "breezy.hr",
    "paylocity.com",
    "gem.com",
)


def _is_ats_or_consumer_domain(domain: str) -> bool:
    d = domain.lower()
    if d in _CONSUMER_DOMAINS:
        return True
    for ad in _ATS_EMAIL_DOMAINS:
        if d == ad or d.endswith("." + ad):
            return True
    return False


def _is_recruiting_vendor_domain(domain: str) -> bool:
    d = domain.lower()
    if _is_ats_or_consumer_domain(d):
        return True
    for suf in _RECRUITING_VENDOR_DOMAIN_SUFFIXES:
        if d == suf or d.endswith("." + suf):
            return True
    if "greenhouse" in d or "handshake" in d or "mindbody" in d or "coderpad" in d:
        return True
    if "paylocity" in d or d.endswith(".gem.com") or d == "gem.com":
        return True
    return False


# Names that are almost always ATS noise, not the hiring company.
_VENDOR_COMPANY_TOKENS = frozenset(
    {
        "greenhouse",
        "mail",
        "noreply",
        "notifications",
        "mindbody",
        "mindbodyonline",
        "workday",
        "lever",
        "ashby",
        "icims",
        "smartrecruiters",
        "indeed",
        "linkedin",
        "recruiting",
        "talent",
        "team",
        "applications",
        "careers",
        "jobs",
        "ripplematch",
        "gem",
    }
)


def _company_from_workday_local(local: str) -> str | None:
    """myworkday.com sends as employer@myworkday.com — use local part when recognizable."""
    s = local.lower().strip()
    s = re.sub(
        r"(_noreply|noreply|no-reply|notifications|careers|talent|recruiting|hr|wd\d+)$",
        "",
        s,
        flags=re.I,
    )
    s = s.strip("._-")
    s = re.sub(r"(careers|jobs|talent)$", "", s, flags=re.I).rstrip("._-")
    if len(s) < 3 or s in ("admin", "wday", "svc", "donotreply", "service", "system"):
        return None
    for suf in (
        "solutions",
        "technologies",
        "technology",
        "holdings",
        "healthcare",
        "industries",
        "international",
    ):
        if s.endswith(suf) and len(s) > len(suf) + 3:
            pref = s[: -len(suf)]
            if pref.isalpha():
                cand = _company_acronym_fix(_title_case(f"{pref} {suf}"))
                cleaned = _sanitize_company_candidate(cand)
                if cleaned:
                    return cleaned
    cand = _company_acronym_fix(_title_case(s.replace("-", " ").replace("_", " ")))
    return _sanitize_company_candidate(cand)


def _company_from_compound_sld(sld: str) -> str | None:
    """mavensecurities.com → Maven Securities; tranetechnologies → Trane Technologies."""
    m = re.match(
        r"^(.{2,28}?)(securities|technologies|technology|capital|holdings|ventures|partners|advisors|management|labs)$",
        sld,
        re.I,
    )
    if not m:
        return None
    left, right = m.group(1), m.group(2)
    if len(left) < 2 or not re.match(r"^[a-z]+$", left, re.I):
        return None
    return _company_acronym_fix(_title_case(f"{left} {right}"))


def _sanitize_company_candidate(raw: str) -> str | None:
    c = re.sub(r"\s+", " ", (raw or "").strip()).strip(".,;:!?*\"'")
    if re.match(r"^the\s+.+", c, re.I):
        c = c[4:].strip()
    if len(c) < 2 or len(c) > 56:
        return None
    low = c.lower()
    if low in _VENDOR_COMPANY_TOKENS:
        return None
    first = c.split()[0].lower()
    if first in _VENDOR_COMPANY_TOKENS:
        return None
    # "interest in joining our team" false positives when ATS title-cases "Joining"
    if first in (
        "joining",
        "applying",
        "considering",
        "learning",
        "hearing",
        "exploring",
        "seeing",
    ):
        return None
    if re.match(r"^(your|our|this)\s+", low):
        return None
    # Allow "The New York Times" but not bare "The"
    if low == "the":
        return None
    return _company_acronym_fix(_title_case(c))


def _company_acronym_fix(s: str) -> str:
    parts = s.split()
    if not parts:
        return s
    out = []
    for w in parts:
        lw = w.lower()
        if lw in _ROLE_ACRONYM_FIXES:
            out.append(_ROLE_ACRONYM_FIXES[lw])
        else:
            out.append(w)
    return " ".join(out)


def extract_company(subject: str, body: str, from_header: str | None) -> str | None:
    """
    Prefer explicit employer strings in subject/body (ATS emails lie about the domain).
    Use From domain only for obvious corporate senders.
    """
    subj = _normalize_recruiting_text((subject or "").strip())
    body = _normalize_recruiting_text(body or "")
    comb = f"{subj}\n{body}"

    # Use regular spaces inside company tokens only — \s+ would span newlines and
    # pull the next line's "Interest" into "Playlist".
    _w = r"(?: +[A-Z][\w&.'-]*)"
    _PHRASE_PATTERNS = [
        # Thanks for applying to Stripe / Thank you for applying to …
        re.compile(
            r"thanks?\s+for\s+applying\s+to\s+"
            r"([A-Z][\w&.'-]*(?:%s){0,6})"
            r"(?=\s*[!.]|\s*$|\n)" % _w,
            re.I | re.M,
        ),
        # Thank you for applying to Esri's … (stop before role title)
        re.compile(
            r"thank you for (?:applying|your application)\s+to\s+([A-Z][a-z]{1,22})'s\b",
            re.I | re.M,
        ),
        # Thank you for applying to Handshake / Playlist / …
        re.compile(
            r"thank you for (?:applying|your application)\s+to\s+"
            r"([A-Z][\w&.'-]*(?:%s){0,6})"
            r"(?=\s*[!.]|\s*$|\n|\s+for\s+(?:the\s+|a\s+|an\s+)?[a-z])" % _w,
            re.I | re.M,
        ),
        # "… the APX (New Grad) role at Sierra" — require 2+ tokens so APX isn't a company
        re.compile(
            r"thank you for your interest in the\s+"
            r"([A-Z][\w&.'-]*(?:\s+[A-Z][\w&.'-]*){1,12}?)"
            r"(?:\s*\(|,|\.|!|\n|\s+position)",
            re.I | re.M,
        ),
        # Single-word org before "position": "interest in the Stripe position"
        re.compile(
            r"thank you for your interest in the\s+([A-Z][a-z]{2,28})\s+position\b",
            re.I | re.M,
        ),
        # Sierra-style: explicit employer after "role at"
        re.compile(
            r"\brole at\s+([A-Z][\w&.'-]*(?: +[A-Z][\w&.'-]*){0,3})(?=\s*[!.]|\s*$|\n)",
            re.I,
        ),
        # Thank you for your interest in Sierra / single-token company in subject
        re.compile(
            r"thank you for your interest in\s+"
            r"([A-Z][\w&.'-]*(?:%s){0,6})"
            r"(?=\s*[!.]|,|\s*$|\n|\s+and\b)" % _w,
            re.I | re.M,
        ),
        # "Company has decided not to move forward…" (RippleMatch / a16z-style)
        re.compile(
            r"\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,5})\s+has decided not to move forward with your application\b",
            re.I,
        ),
        # Thank you from Scale AI! (subject line)
        re.compile(
            r"thank you from\s+"
            r"([A-Z][\w&.'-]*(?:%s){0,3})"
            r"(?=\s*[!.]|\s*$|\n)" % _w,
            re.I | re.M,
        ),
        # Next steps with Benchling - CoderPad …
        re.compile(
            r"\bnext steps with\s+([A-Z][\w&.'-]*(?:%s){0,5})\s*[-—–]" % _w,
            re.I,
        ),
        # Update from Divergent (Greenhouse etc.)
        re.compile(
            r"\bupdate from\s+([A-Z][\w&.'-]*(?:%s){0,5})\b" % _w,
            re.I,
        ),
        # Update on Salesforce's Software Engineering …
        re.compile(
            r"\bUpdate on\s+([A-Z][\w&.'-]*(?:%s){0,4})'s\b" % _w,
            re.I,
        ),
        # Paylocity-style header: "The Morgridge Institute for Research Inc [88259]"
        re.compile(
            r"(?m)^\s*The\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){2,8})\s+Inc\s*[\[,.]",
            re.I,
        ),
        # Bumble — We've Got Your Application (Unicode dashes)
        re.compile(
            r"(?m)^\s*([A-Z][a-zA-Z0-9&.'-]{1,42}(?: +[A-Z][a-zA-Z0-9&.'-]{1,42}){0,2})\s*[—–\-]\s*We'?ve\b",
            re.I,
        ),
        # The Playlist Talent Acquisition Team
        re.compile(
            r"\b([A-Z][\w&.'-]*(?:%s){0,5})\s+Talent Acquisition(?:\s+Team)?\b" % _w,
            re.I,
        ),
        re.compile(
            r"\b(?:Recruiting|Hiring) Team at\s+([A-Z][\w&.'-]*(?:%s){0,5})\b" % _w,
            re.I,
        ),
        # "Your Sam's Club Hiring Team"
        re.compile(
            r"\b(?:Your|Our|The)\s+((?:[A-Z][\w'.-]*)(?:\s+[A-Z][\w'.-]*){0,4})\s+Hiring Team\b",
            re.I,
        ),
        re.compile(
            r"\bapplication (?:for|to)\s+.{0,120}?\bat\s+([A-Z][\w&.'-]*(?:%s){0,5})\b" % _w,
            re.I | re.S,
        ),
        re.compile(
            r"\bposition (?:at|with)\s+"
            r"([A-Z][\w&.'-]*(?: +[A-Z][\w&.'-]*){0,4})"
            r"(?=\s*[\.,!?\n]|$)",
            re.I,
        ),
        re.compile(
            r"\b(?:join|team at)\s+([A-Z][\w&.'-]*(?:%s){0,4}?)\s*[.!]?\s*$" % _w,
            re.I | re.M,
        ),
    ]

    for pat in _PHRASE_PATTERNS:
        m = pat.search(comb)
        if m:
            cleaned = _sanitize_company_candidate(m.group(1))
            if cleaned:
                return cleaned

    # Subject-leading brand before em dash (Bumble — …)
    m = re.match(
        r"^\s*([A-Z][a-zA-Z0-9&.'-]{1,42}(?: +[A-Z][a-zA-Z0-9&.'-]{1,42}){0,2})\s*[—–\-]",
        subj,
    )
    if m:
        cleaned = _sanitize_company_candidate(m.group(1))
        if cleaned:
            return cleaned

    m = re.search(
        r"(?:^|[\s:—\-])([A-Z][a-z]+)\s+(?:AI|ML|Data|Software|University|Summer|Winter)\s+",
        subj,
    )
    if m:
        return m.group(1)

    # "Your application for … at Pinterest" (subject)
    m = re.search(
        r"\bat\s+([A-Z][\w&.'-]*(?: +[A-Z][\w&.'-]*){0,3})\s*$",
        subj,
        re.I,
    )
    if m:
        cleaned = _sanitize_company_candidate(m.group(1))
        if cleaned:
            return cleaned

    fh = (from_header or "").strip()
    mwd = re.search(r"([\w.+-]+)@([a-z0-9-]*\bmyworkday\.com)\b", fh, re.I)
    if mwd:
        wco = _company_from_workday_local(mwd.group(1))
        if wco:
            return wco

    if re.search(r"\bGoogle Application\b", subj, re.I) and re.search(
        r"careers\.google|\binterest in Google\b|\bvalue your interest in Google\b",
        comb,
        re.I | re.S,
    ):
        gg = _sanitize_company_candidate("Google")
        if gg:
            return gg

    # Domain fallback: real corporate domains only (not ATS / white-label).
    em = re.search(r"[\w.+-]+@([\w-]+(?:\.[\w-]+)+)", fh)
    if em:
        domain = em.group(1).lower()
        if not _is_recruiting_vendor_domain(domain):
            parts = domain.split(".")
            sld = parts[-2] if len(parts) >= 2 else parts[0]
            if sld not in (
                "no-reply",
                "noreply",
                "mail",
                "email",
                "notifications",
                "careers",
                "jobs",
                "talent",
                "www",
            ) and len(sld) >= 2:
                flat = sld.replace("-", "")
                splitc = _company_from_compound_sld(flat)
                if splitc:
                    cleaned = _sanitize_company_candidate(splitc)
                    if cleaned:
                        return cleaned
                cand = _title_case(sld.replace("-", " "))
                cleaned = _sanitize_company_candidate(cand)
                if cleaned:
                    return cleaned

    return None


def _title_case(s: str) -> str:
    small = {"and", "or", "of", "the", "a", "an", "in", "on", "at", "to", "for"}
    parts = s.split()
    out = []
    for i, w in enumerate(parts):
        lw = w.lower()
        if i == 0 or lw not in small:
            out.append(w[:1].upper() + w[1:].lower() if w else w)
        else:
            out.append(lw)
    return " ".join(out)


_ROLE_ACRONYM_FIXES = {
    "ai": "AI",
    "ml": "ML",
    "ui": "UI",
    "ux": "UX",
    "api": "API",
    "it": "IT",
    "hr": "HR",
    "sde": "SDE",
    "nlp": "NLP",
    "apx": "APX",
    "hpe": "HPE",
}


def _smart_title_role(s: str) -> str:
    """Title-case role strings but keep common tech acronyms uppercase."""
    t = _title_case(s)
    parts = t.split()
    fixed = []
    for w in parts:
        lw = w.lower()
        if lw in _ROLE_ACRONYM_FIXES:
            fixed.append(_ROLE_ACRONYM_FIXES[lw])
        else:
            fixed.append(w)
    return " ".join(fixed)


def rule_signals(subject: str, body: str) -> list[str]:
    t = _normalize_recruiting_text(f"{subject or ''} {body or ''}")
    subj = _normalize_recruiting_text(subject or "")
    sig: list[str] = []
    if has_strong_rejection(t) or is_offer_to_other(t):
        sig.append("Strong rejection / other-candidate wording")
    elif has_strong_offer(t):
        sig.append("Explicit offer / compensation language")
    elif has_assessment_signal(t, subj):
        sig.append("Coding assessment / take-home / CoderPad-style step")
    elif has_strong_interview(t) or has_interview_subject_hint(subj):
        sig.append("Interview / phone screen scheduling")
    elif has_applied_receipt(t):
        sig.append("Application receipt / thank-you-for-applying")
    return sig[:4]


def classify_rules_only(subject: str, body: str, from_header: str | None = None) -> dict[str, Any]:
    """Full Appli.io schema from rules alone."""
    text = _normalize_recruiting_text(f"{subject or ''} {body or ''}")
    subj = _normalize_recruiting_text(subject or "")
    status = predict_status(text, subj)
    role = extract_role(subj, body or "")
    company = extract_company(subj, body or "", from_header)
    signals = rule_signals(subj, body or "")

    if status is None:
        return {
            "status": None,
            "role": role,
            "company": company,
            "reason": "No high-confidence rule match for this email (not classified as application pipeline mail).",
            "confidence": 0.35,
            "signals": signals or ["Rules: inconclusive"],
            "nextAction": None,
            "summary": None,
            "source": "python_rules",
        }

    reasons = {
        "Rejected": "Rule engine: rejection or non-selection wording detected.",
        "Offer": "Rule engine: positive offer / compensation wording detected.",
        "Assessment": "Rule engine: coding challenge or async assessment (e.g. CoderPad, HackerRank) detected.",
        "Interview": "Rule engine: interview scheduling or invite wording detected.",
        "Applied": "Rule engine: application received / confirmation wording detected.",
    }
    return {
        "status": status,
        "role": role,
        "company": company,
        "reason": reasons.get(status, "Rule-based classification."),
        "confidence": 0.78,
        "signals": signals,
        "nextAction": None,
        "summary": reasons.get(status),
        "source": "python_rules",
    }
