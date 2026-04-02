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
        r"(not (be )?moving forward|other candidate|regret|unable to offer|not selected|decided not|"
        r"will not be moving|chosen (another|a different|other))",
        re.I | re.S,
    ),
    re.compile(
        r"unfortunately.{0,140}?"
        r"(not selected|not moving forward|unable to|regret|other candidate|will not be|decided not|pursue other)",
        re.I | re.S,
    ),
]

_OFFER_OTHER = re.compile(
    r"offer.{0,40}(other|another) candidate|(other|another) candidate.{0,40}offer", re.I | re.S
)
_INTERVIEW = re.compile(
    r"schedule (a |an )?(time|call|interview|phone screen)|"
    r"availability for (a |an )?(call|interview)|"
    r"invite you to (a |an )?interview|"
    r"next steps? (is|are|would be) (to |)(a |an )?interview|"
    r"phone screen (with|for|w/)",
    re.I,
)
_OFFER_POS = re.compile(
    r"pleased to (extend|offer)|delighted to offer|happy to offer|would like to (extend|offer)|"
    r"formal (job )?offer|offer letter( attached)?|compensation package|base salary|starting salary",
    re.I,
)
_REJECT_NEAR = re.compile(r"not (be )?moving forward|unable to offer", re.I)
_APPLIED = re.compile(
    r"received your application|thank you for (your )?applying|application (has been )?received|"
    r"we (have )?received your application",
    re.I,
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


def predict_status(text: str) -> str | None:
    if not (text or "").strip():
        return None
    t = str(text)
    if has_strong_rejection(t) or is_offer_to_other(t):
        return "Rejected"
    if has_strong_offer(t):
        return "Offer"
    if has_strong_interview(t):
        return "Interview"
    if has_applied_receipt(t):
        return "Applied"
    return None


def extract_role(subject: str, body: str) -> str | None:
    blob = f"{subject} {body}".lower()
    subj = (subject or "").lower()
    for pat in _ROLE_PATTERNS:
        m = pat.search(blob)
        if m:
            return _title_case(m.group(0).strip())
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


def rule_signals(subject: str, body: str) -> list[str]:
    t = f"{subject} {body}"
    sig: list[str] = []
    if has_strong_rejection(t) or is_offer_to_other(t):
        sig.append("Strong rejection / other-candidate wording")
    elif has_strong_offer(t):
        sig.append("Explicit offer / compensation language")
    elif has_strong_interview(t):
        sig.append("Scheduling or interview invite language")
    elif has_applied_receipt(t):
        sig.append("Application receipt / thank-you-for-applying")
    return sig[:4]


def classify_rules_only(subject: str, body: str) -> dict[str, Any]:
    """Full Appli.io schema from rules alone."""
    text = f"{subject or ''} {body or ''}"
    status = predict_status(text)
    role = extract_role(subject or "", body or "")
    signals = rule_signals(subject or "", body or "")

    if status is None:
        return {
            "status": None,
            "role": role,
            "company": None,
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
        "Interview": "Rule engine: interview scheduling or invite wording detected.",
        "Applied": "Rule engine: application received / confirmation wording detected.",
    }
    return {
        "status": status,
        "role": role,
        "company": None,
        "reason": reasons.get(status, "Rule-based classification."),
        "confidence": 0.78,
        "signals": signals,
        "nextAction": None,
        "summary": reasons.get(status),
        "source": "python_rules",
    }
