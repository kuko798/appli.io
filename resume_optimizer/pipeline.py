from __future__ import annotations

from typing import Optional, Union

from .analyzer import analyze_bullet
from .domain import detect_domain
from .llm import chat_completion
from .models import BulletInput, BulletOutput, BulletScore
from .prompts import build_rewrite_prompt
from .utils import parse_rewrite_versions


def rewrite_bullet(
    bullet_input: Union[BulletInput, dict],
    *,
    model: Optional[str] = None,
    base_url: Optional[str] = None,
    skip_score: bool = False,
) -> BulletOutput:
    """
    Domain detect → optional score → domain-aware rewrite → three plain-text versions.
    """
    if isinstance(bullet_input, dict):
        bullet_input = BulletInput.model_validate(bullet_input)
    bullet = bullet_input.text.strip()
    if not bullet:
        raise ValueError("bullet text is empty")

    domain = detect_domain(bullet, model=model, base_url=base_url)
    score: BulletScore
    if skip_score:
        score = BulletScore(
            impact=0,
            clarity=0,
            specificity=0,
            has_metrics=False,
            suggestions=["Scoring skipped (skip_score=True)."],
        )
    else:
        score = analyze_bullet(bullet, model=model, base_url=base_url)

    prompt = build_rewrite_prompt(
        bullet,
        domain,
        role=bullet_input.role,
        company=bullet_input.target_company,
        job_description=bullet_input.job_description,
    )
    response = chat_completion(
        [{"role": "user", "content": prompt}],
        temperature=0.35,
        max_tokens=500,
        model=model,
        base_url=base_url,
    )
    versions = parse_rewrite_versions(response, max_versions=3)
    while len(versions) < 3:
        versions.append(versions[-1] if versions else bullet)

    return BulletOutput(domain=domain, improved_versions=versions[:3], score=score)
