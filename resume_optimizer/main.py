"""
CLI for the domain-agnostic bullet pipeline.

Examples:
  python -m resume_optimizer.main --bullet "Helped customers at the front desk daily"
  python -m resume_optimizer.main -b "Taught algebra to high school students" --role "Math Teacher"

Requires RESUME_OPTIMIZER_BASE_URL (default http://127.0.0.1:8000) pointing at an OpenAI-compatible server.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# Allow `python resume_optimizer/main.py` from repo root
_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from resume_optimizer.models import BulletInput
from resume_optimizer.pipeline import rewrite_bullet


def main() -> None:
    p = argparse.ArgumentParser(description="Domain-agnostic resume bullet optimizer")
    p.add_argument("-b", "--bullet", required=True, help="Single resume bullet or duty line")
    p.add_argument("--role", default=None, help="Current or target job title")
    p.add_argument("--company", default=None, dest="target_company", help="Target employer name")
    p.add_argument("--jd", default=None, dest="job_description", help="Path to job description text file")
    p.add_argument("--model", default=None, help="Override LLM model id for the chat API")
    p.add_argument("--base-url", default=None, help="Override RESUME_OPTIMIZER_BASE_URL")
    p.add_argument("--skip-score", action="store_true", help="Only detect domain + rewrite (faster)")
    p.add_argument("--json", action="store_true", dest="as_json", help="Print JSON only")
    args = p.parse_args()

    jd_text = None
    if args.job_description:
        jd_text = Path(args.job_description).read_text(encoding="utf-8", errors="replace")

    inp = BulletInput(
        text=args.bullet,
        role=args.role,
        target_company=args.target_company,
        job_description=jd_text,
    )
    out = rewrite_bullet(
        inp,
        model=args.model,
        base_url=args.base_url,
        skip_score=args.skip_score,
    )
    if args.as_json:
        print(out.model_dump_json(indent=2))
        return

    print("Domain:", out.domain)
    print("\nScores:" if not args.skip_score else "\n(Skipped scores)\n")
    if not args.skip_score:
        s = out.score
        print(f"  impact={s.impact}/10  clarity={s.clarity}/10  specificity={s.specificity}/10  metrics={s.has_metrics}")
        for t in s.suggestions:
            print(f"  - {t}")
    print("\nVersions:")
    for i, v in enumerate(out.improved_versions, 1):
        print(f"  {i}. {v}")


if __name__ == "__main__":
    main()
